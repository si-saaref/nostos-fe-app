import { toAccount } from '@/modules/settings/api/accounts'
import type { WireAccount } from '@/types/catalog'

const wire = (kind: string): WireAccount =>
  ({
    id: 'source-tunai',
    name: 'Tunai',
    kind,
    opening_balance: '1500000.00',
    as_of: '2026-05-01',
    order: 0,
    archived_at: null,
    household_id: 'household-001',
    system_key: 'DEFAULT_CASH',
  }) as WireAccount

describe('toAccount', () => {
  it.each([
    ['CASH', 'cash'],
    ['BANK', 'bank'],
    ['EWALLET', 'ewallet'],
  ])('maps the wire %s onto the domain %s', (sent, expected) => {
    expect(toAccount(wire(sent)).kind).toBe(expected)
  })

  // The cutover: until the API ships uppercase it still sends lowercase, and
  // an undefined `kind` renders an unselected radio group in Settings.
  it.each(['cash', 'bank', 'ewallet'])(
    'passes a lowercase %s through during the cutover',
    (sent) => {
      expect(toAccount(wire(sent)).kind).toBe(sent)
    },
  )

  it('leaves the rest of the row alone', () => {
    expect(toAccount(wire('CASH'))).toEqual({
      calculationStartCanSet: false,
      calculationStartSetAt: null,
      id: 'source-tunai',
      name: 'Tunai',
      kind: 'cash',
      openingBalance: 1500000,
      asOf: '2026-05-01',
      order: 0,
      archivedAt: null,
      householdId: 'household-001',
      systemKey: 'DEFAULT_CASH',
      isProtected: true,
    })
  })

  it('degrades a legacy row without a system key to an ordinary account', () => {
    const legacy = wire('BANK')
    delete (legacy as Partial<WireAccount>).system_key

    expect(toAccount(legacy)).toMatchObject({
      systemKey: null,
      isProtected: false,
    })
  })
})

import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { createTestQueryClient } from '@/test/test-utils'
import { useCreateAccount } from '@/modules/settings/api/accounts'
import { getErrorCode, getErrorMessage } from '@/utils/errors'
import { db } from '@/mocks/db'
import { apiClient } from '@/api/client'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
)

/** The wording names the account and is rendered verbatim, so assert it verbatim. */
describe('creating an account with a name already in use', () => {
  it('rejects with a 409 whose wording names the account', async () => {
    const taken = db.accounts[0].name

    const { result } = renderHook(() => useCreateAccount('household-001'), {
      wrapper,
    })

    await expect(
      result.current.mutateAsync({
        name: taken,
        kind: 'cash',
        openingBalance: 0,
        asOf: '2026-05-01',
      }),
    ).rejects.toBeDefined()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(getErrorCode(result.current.error)).toBe('CONFLICT')
    expect(getErrorMessage(result.current.error)).toBe(
      `Akun "${taken}" sudah ada`,
    )
  })
})

describe('mock financial validation', () => {
  it.each(['01.00', '1000000000000.00'])(
    'rejects invalid adjustment %s with a 400',
    async (amount) => {
      const source = db.accounts[0]
      await expect(
        apiClient.post(`/payment-sources/${source.id}/adjustments`, {
          direction: 'INCREASE',
          amount,
          date: source.asOf,
          reason: 'Counted again',
        }),
      ).rejects.toMatchObject({ response: { status: 400 } })
    },
  )
})

it('maps explicit server start-date eligibility without deriving it from balances', () => {
  expect(
    toAccount({
      ...wire('CASH'),
      calculation_start_can_set: true,
      calculation_start_set_at: null,
    }),
  ).toMatchObject({ calculationStartCanSet: true, calculationStartSetAt: null })
  expect(toAccount(wire('CASH')).calculationStartCanSet).toBe(false)
})

it('patches only an explicit start date and invalidates current positions', async () => {
  const { http, HttpResponse } = await import('msw')
  const { server } = await import('@/mocks/server')
  const { useUpdateAccount } = await import('./accounts')
  const { positionKeys } = await import('@/modules/financial/api/positions')
  let body: unknown
  server.use(
    http.patch('*/payment-sources/:id', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({
        success: true,
        data: {
          ...wire('CASH'),
          as_of: '2026-10-01',
          calculation_start_can_set: false,
          calculation_start_set_at: '2026-10-29T00:00:00Z',
        },
      })
    }),
  )
  const client = createTestQueryClient()
  const positionKey = positionKeys.scoped('household-001', {
    asOf: '2026-10-29',
    from: '2026-10-01',
  })
  client.setQueryData(positionKey, { balance: '123' })
  const { result } = renderHook(() => useUpdateAccount('household-001'), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
  await result.current.mutateAsync({ id: 'source-tunai', asOf: '2026-10-01' })
  expect(body).toEqual({ as_of: '2026-10-01' })
  expect(client.getQueryState(positionKey)?.isInvalidated).toBe(true)
})
