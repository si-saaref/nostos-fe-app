import { act, renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@/test/test-utils'
import {
  useActivePayers,
  useInviteMember,
  useMembers,
  useRemoveMember,
  useResendInvite,
  useRoster,
} from '@/modules/settings/api/members'
import { getErrorMessage } from '@/utils/errors'

const HOUSEHOLD_ID = 'household-001'

/**
 * `GET /households/:id/members` is the household's only people endpoint —
 * there is no `/users`. These cover the two things that made folding them
 * together worth doing: one cache both views read, and tombstones that reach
 * the ledger's name resolution instead of being filtered away.
 */
const setup = () =>
  renderHook(
    () => ({
      members: useMembers(HOUSEHOLD_ID),
      roster: useRoster(HOUSEHOLD_ID),
      payers: useActivePayers(HOUSEHOLD_ID),
      invite: useInviteMember(HOUSEHOLD_ID),
      resend: useResendInvite(HOUSEHOLD_ID),
      remove: useRemoveMember(HOUSEHOLD_ID),
    }),
    { wrapper: createWrapper() },
  )

describe('useMembers', () => {
  it('maps the snake_case payload onto the domain shape', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.members.isSuccess).toBe(true))

    const asep = result.current.members.data?.find(
      (member) => member.name === 'Asep',
    )
    expect(asep).toMatchObject({
      householdId: HOUSEHOLD_ID,
      status: 'pending',
      resendCount: 1,
    })
    expect(asep?.inviteExpiresAt).toBeTruthy()
    expect(asep).not.toHaveProperty('invite_expires_at')
  })

  it('carries the server-derived status rather than re-deriving it', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.members.isSuccess).toBe(true))

    const byName = new Map(
      result.current.members.data?.map((member) => [member.name, member]),
    )
    expect(byName.get('Budi')?.status).toBe('joined')
    expect(byName.get('Asep')?.status).toBe('pending')
    expect(byName.get('Dewi')?.status).toBe('left')
    // An invite past its 48 hours: a state the FE previously collapsed into
    // 'pending', which gave no reason the link had stopped working.
    expect(byName.get('Tono')?.status).toBe('invite_expired')
  })

  it('keeps tombstoned members on the roster and off the payer picker', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.roster.isSuccess).toBe(true))

    const onRoster = result.current.roster.data?.some(
      (user) => user.name === 'Dewi',
    )
    const isPayer = result.current.payers.data?.some(
      (user) => user.name === 'Dewi',
    )
    // Dewi left, and her old expenses still have to resolve to a name — the
    // roster is what makes attribution survive removal.
    expect(onRoster).toBe(true)
    // …but nothing new may be attributed to her.
    expect(isPayer).toBe(false)
  })

  it('is disabled when householdId is empty', () => {
    const { result } = renderHook(() => useMembers(''), {
      wrapper: createWrapper(),
    })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useInviteMember', () => {
  it('keeps a new pending invite off the payer picker', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.payers.isSuccess).toBe(true))

    await act(async () => {
      await result.current.invite.mutateAsync({
        firstName: 'Nadia',
        lastName: 'Putri',
        email: 'nadia@example.com',
      })
    })

    // The roster updates from one cache key, but pending members cannot
    // be named as payers until they accept the invitation.
    await waitFor(() =>
      expect(
        result.current.members.data?.some((row) => row.name === 'Nadia Putri'),
      ).toBe(true),
    )
    expect(
      result.current.roster.data?.find((row) => row.name === 'Nadia Putri'),
    ).toMatchObject({ firstName: 'Nadia', lastName: 'Putri' })
    expect(
      result.current.payers.data?.some((row) => row.name === 'Nadia Putri'),
    ).toBe(false)
  })

  it('returns the invite with its pending status and expiry', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.members.isSuccess).toBe(true))

    let created: Awaited<
      ReturnType<typeof result.current.invite.mutateAsync>
    > | null = null
    await act(async () => {
      created = await result.current.invite.mutateAsync({
        firstName: 'Nadia',
        lastName: 'Putri',
        email: 'nadia@example.com',
      })
    })

    expect(created).toMatchObject({ status: 'pending', resendCount: 0 })
    expect(created!.inviteSentAt).toBeTruthy()
  })

  it('surfaces the 409 wording verbatim — the copy is the feature', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.members.isSuccess).toBe(true))

    await act(async () => {
      await result.current.invite
        .mutateAsync({
          firstName: 'Sari',
          lastName: 'lagi',
          email: 'sari@example.com',
        })
        .catch(() => undefined)
    })

    await waitFor(() => expect(result.current.invite.isError).toBe(true))
    expect(getErrorMessage(result.current.invite.error)).toMatch(
      /already in a household/i,
    )
  })
})

describe('useResendInvite', () => {
  it('spends one of the ration and re-stamps the invite', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.members.isSuccess).toBe(true))
    const asep = result.current.members.data!.find(
      (member) => member.name === 'Asep',
    )!

    await act(async () => {
      await result.current.resend.mutateAsync(asep.id)
    })

    await waitFor(() =>
      expect(
        result.current.members.data?.find((row) => row.id === asep.id)
          ?.resendCount,
      ).toBe(2),
    )
  })

  it('answers 429 once the ration is spent, not 409', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.members.isSuccess).toBe(true))
    // Tono has all three resends spent.
    const tono = result.current.members.data!.find(
      (member) => member.name === 'Tono',
    )!

    await act(async () => {
      await result.current.resend.mutateAsync(tono.id).catch(() => undefined)
    })

    await waitFor(() => expect(result.current.resend.isError).toBe(true))
    // The exhausted branch was wired to 409, a status this route never sends —
    // the ration is a throttle, and the copy keys off which of the two it is.
    expect(
      (result.current.resend.error as { response?: { status?: number } })
        ?.response?.status,
    ).toBe(429)
  })
})

describe('useRemoveMember', () => {
  it('tombstones rather than deletes, so attribution survives', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.members.isSuccess).toBe(true))
    const sari = result.current.members.data!.find(
      (member) => member.name === 'Sari',
    )!

    await act(async () => {
      await result.current.remove.mutateAsync(sari.id)
    })

    await waitFor(() => {
      const row = result.current.members.data?.find((r) => r.id === sari.id)
      expect(row?.status).toBe('removed')
      expect(row?.deletionReason).toBe('REMOVED')
    })
    // Still nameable on her old expenses, but no longer a valid payer.
    expect(result.current.roster.data?.some((u) => u.id === sari.id)).toBe(true)
    expect(result.current.payers.data?.some((u) => u.id === sari.id)).toBe(
      false,
    )
  })

  it('refuses to remove the household admin', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.members.isSuccess).toBe(true))
    const budi = result.current.members.data!.find(
      (member) => member.name === 'Budi',
    )!

    await act(async () => {
      await result.current.remove.mutateAsync(budi.id).catch(() => undefined)
    })

    await waitFor(() => expect(result.current.remove.isError).toBe(true))
    expect(
      result.current.members.data?.find((row) => row.id === budi.id)?.deletedAt,
    ).toBeNull()
  })
})

it('sends the structured BE contract and preserves both names on the roster', async () => {
  const { http, HttpResponse } = await import('msw')
  const { server } = await import('@/mocks/server')
  const { toMember } = await import('./members')
  let body: unknown
  server.use(
    http.post('*/households/:id/members', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({
        success: true,
        data: {
          id: 'new',
          name: 'Nadia Putri',
          first_name: 'Nadia',
          last_name: 'Putri',
          email: 'nadia@example.com',
          role: 'MEMBER',
          household_id: HOUSEHOLD_ID,
          status: 'pending',
          resend_count: 0,
          invite_sent_at: null,
          invite_expires_at: null,
          deleted_at: null,
          deletion_reason: null,
        },
      })
    }),
  )
  const { result } = setup()
  let created: unknown
  await act(async () => {
    created = await result.current.invite.mutateAsync({
      firstName: 'Nadia',
      lastName: 'Putri',
      email: 'nadia@example.com',
    })
  })
  expect(body).toEqual({
    first_name: 'Nadia',
    last_name: 'Putri',
    email: 'nadia@example.com',
  })
  expect(created).toMatchObject({ firstName: 'Nadia', lastName: 'Putri' })
  const legacy = toMember({
    id: 'old',
    name: 'Legacy',
    email: 'old@example.com',
    role: 'MEMBER',
    household_id: HOUSEHOLD_ID,
    status: 'joined',
    resend_count: 0,
    invite_sent_at: null,
    invite_expires_at: null,
    deleted_at: null,
    deletion_reason: null,
  })
  expect(legacy.name).toBe('Legacy')
})

it('rejects obsolete name-only invites at the mock boundary', async () => {
  const { apiClient } = await import('@/api/client')
  await expect(
    apiClient.post(`/households/${HOUSEHOLD_ID}/members`, {
      name: 'Old contract',
      email: 'old@example.com',
    }),
  ).rejects.toMatchObject({ response: { status: 400 } })
})
