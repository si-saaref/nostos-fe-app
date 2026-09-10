import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@/test/test-utils'
import { apiClient } from '@/api/client'
import { resetMockState } from '@/mocks/db'
import { server } from '@/mocks/server'
import { MOCK_ME } from '@/mocks/fixtures/household'
import { INCOME_TYPE_IDS } from '@/mocks/fixtures/incomeTypes'
import { ACCOUNT_IDS } from '@/mocks/fixtures/accounts'
import { getErrorCode } from '@/utils/errors'
import {
  toIncome,
  useCreateIncome,
  useDeleteIncome,
  useIncome,
  useUpdateIncome,
} from '@/modules/financial/api/income'
import { monthRange } from '@/utils/dates'
import type { WireIncome } from '@/types/income'

const HOUSEHOLD = MOCK_ME.household_id
const thisMonth = monthRange(new Date())
const FILTERS = { ...thisMonth, page: 1, limit: 400 }

beforeEach(() => {
  resetMockState()
})

describe('toIncome', () => {
  it('maps every snake_case key, keeping a null from_source_id null', () => {
    const wire: WireIncome = {
      id: 'inc-1',
      name: 'Salary Sep',
      amount: 5000000,
      type_id: 'itype-0',
      from_source_id: null,
      to_source_id: 'source-bni',
      date: '2026-09-04',
      household_id: HOUSEHOLD,
      created_by_user_id: 'user-1',
      updated_by_admin_id: null,
      created_at: '2026-09-04T02:00:00.000Z',
      updated_at: null,
    }

    expect(toIncome(wire)).toEqual({
      id: 'inc-1',
      name: 'Salary Sep',
      amount: 5000000,
      typeId: 'itype-0',
      fromSourceId: null,
      toSourceId: 'source-bni',
      date: '2026-09-04',
      householdId: HOUSEHOLD,
      createdByUserId: 'user-1',
      updatedByAdminId: null,
      createdAt: '2026-09-04T02:00:00.000Z',
      updatedAt: null,
    })
  })
})

describe('useIncome', () => {
  it('returns a page whose totals describe the whole filtered set', async () => {
    const { result } = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const page = result.current.data
    expect(page?.items.length).toBeGreaterThan(0)
    expect(page?.totals?.count).toBe(page?.pagination.total)
  })

  it('nets transfers out of the sum, so sum equals external inflow only', async () => {
    const { result } = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const items = result.current.data?.items ?? []
    const external = items
      .filter((row) => row.fromSourceId === null)
      .reduce((total, row) => total + row.amount, 0)

    expect(result.current.data?.totals?.sum).toBe(external)
  })

  it('calls the flat /income route, with tenancy in the header not the path', async () => {
    const seen: string[] = []
    const record = ({ request }: { request: Request }) => {
      seen.push(new URL(request.url).pathname)
    }
    server.events.on('request:start', record)

    const { result } = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    server.events.removeListener('request:start', record)

    expect(seen.some((path) => path.endsWith('/api/v1/income'))).toBe(true)
    expect(seen.some((path) => path.includes('/households/'))).toBe(false)
  })

  it('surfaces the three figures the server computes over the whole set', async () => {
    const { result } = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const items = result.current.data?.items ?? []
    const transfers = items.filter((row) => row.fromSourceId !== null)
    const totals = result.current.data?.totals

    expect(totals?.transfer_count).toBe(transfers.length)
    expect(totals?.external_count).toBe(items.length - transfers.length)
    expect(totals?.moved).toBe(
      transfers.reduce((sum, row) => sum + row.amount, 0),
    )
  })

  it('orders newest first', async () => {
    const { result } = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const dates = (result.current.data?.items ?? []).map((row) => row.date)
    expect([...dates].sort().reverse()).toEqual(dates)
  })
})

describe('useCreateIncome', () => {
  it('creates an external inflow and stamps the recorder', async () => {
    const { result } = renderHook(() => useCreateIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      name: 'Salary Sep',
      amount: 5000000,
      typeId: INCOME_TYPE_IDS[0],
      fromSourceId: null,
      toSourceId: ACCOUNT_IDS[0],
      date: thisMonth.from,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.fromSourceId).toBeNull()
    expect(result.current.data?.createdByUserId).toBeTruthy()
  })

  it('sends the type as an id, not a name', async () => {
    const bodies: Record<string, unknown>[] = []
    const record = async ({ request }: { request: Request }) => {
      if (request.method === 'POST') {
        bodies.push((await request.clone().json()) as Record<string, unknown>)
      }
    }
    server.events.on('request:start', record)

    const { result } = renderHook(() => useCreateIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })
    result.current.mutate({
      name: 'Gaji',
      amount: 5000000,
      typeId: INCOME_TYPE_IDS[0],
      fromSourceId: null,
      toSourceId: ACCOUNT_IDS[0],
      date: thisMonth.from,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    server.events.removeListener('request:start', record)

    expect(bodies[0]).toMatchObject({ type_id: INCOME_TYPE_IDS[0] })
    expect(bodies[0]).not.toHaveProperty('type')
    // null is a value on this field, not an omission — the key must be present.
    expect(bodies[0]).toHaveProperty('from_source_id', null)
    expect(result.current.data?.typeId).toBe(INCOME_TYPE_IDS[0])
  })

  it('refuses a type id the household does not have', async () => {
    const { result } = renderHook(() => useCreateIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })
    result.current.mutate({
      name: 'Mystery',
      amount: 1000,
      typeId: 'itype-does-not-exist',
      fromSourceId: null,
      toSourceId: ACCOUNT_IDS[0],
      date: thisMonth.from,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(getErrorCode(result.current.error)).toBe('INVALID_TYPE')
  })

  it('rejects a transfer whose two sources are the same', async () => {
    const { result } = renderHook(() => useCreateIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      name: 'Nowhere',
      amount: 1000,
      typeId: INCOME_TYPE_IDS[0],
      fromSourceId: ACCOUNT_IDS[0],
      toSourceId: ACCOUNT_IDS[0],
      date: thisMonth.from,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('rejects a third decimal place rather than rounding it', async () => {
    const { result } = renderHook(() => useCreateIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      name: 'Odd',
      amount: 10.999,
      typeId: INCOME_TYPE_IDS[0],
      fromSourceId: null,
      toSourceId: ACCOUNT_IDS[0],
      date: thisMonth.from,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useUpdateIncome', () => {
  it('clears from_source_id when the patch sends an explicit null', async () => {
    const list = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true))
    const transfer = list.result.current.data?.items.find(
      (row) => row.fromSourceId !== null,
    )
    expect(transfer).toBeDefined()

    const { result } = renderHook(() => useUpdateIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })
    result.current.mutate({ id: transfer!.id, fromSourceId: null })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.fromSourceId).toBeNull()
    expect(result.current.data?.updatedByAdminId).toBeTruthy()
  })

  it('leaves an absent field alone', async () => {
    const list = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true))
    const row = list.result.current.data!.items[0]

    const { result } = renderHook(() => useUpdateIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })
    result.current.mutate({ id: row.id, amount: 12345 })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.amount).toBe(12345)
    expect(result.current.data?.name).toBe(row.name)
  })
})

describe('useDeleteIncome', () => {
  it('soft-deletes: the row leaves the list and the totals drop it', async () => {
    const wrapper = createWrapper()
    const list = renderHook(() => useIncome(HOUSEHOLD, FILTERS), { wrapper })
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true))
    const before = list.result.current.data!
    const victim = before.items.find((row) => row.fromSourceId === null)!

    const { result } = renderHook(() => useDeleteIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })
    result.current.mutate(victim.id)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const after = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(after.result.current.isSuccess).toBe(true))

    expect(
      after.result.current.data?.items.some((row) => row.id === victim.id),
    ).toBe(false)
    expect(after.result.current.data?.totals?.sum).toBe(
      before.totals!.sum - victim.amount,
    )
  })

  it('answers 404 on a second delete of the same row', async () => {
    const list = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true))
    const id = list.result.current.data!.items[0].id

    const first = renderHook(() => useDeleteIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })
    first.result.current.mutate(id)
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))

    const second = renderHook(() => useDeleteIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })
    second.result.current.mutate(id)
    await waitFor(() => expect(second.result.current.isError).toBe(true))
  })
})

describe('the income wire contract', () => {
  // VALIDATION_ERROR, not WHITELIST_VALIDATION: forbidNonWhitelisted raises a
  // standard validation failure, and WHITELIST_VALIDATION is not in the API's
  // error enum at all.
  it('refuses a body carrying household_id with a 400 VALIDATION_ERROR', async () => {
    const failure = await apiClient
      .post('/income', {
        name: 'Smuggled',
        amount: 1000,
        household_id: HOUSEHOLD,
        from_source_id: null,
        to_source_id: ACCOUNT_IDS[0],
        date: thisMonth.from,
      })
      .catch((error: unknown) => error)

    expect(getErrorCode(failure)).toBe('VALIDATION_ERROR')
  })
})
