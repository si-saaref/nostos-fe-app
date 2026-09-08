import { toAccount } from '@/modules/settings/api/accounts'
import type { WireAccount } from '@/types/catalog'

const wire = (kind: string): WireAccount =>
  ({
    id: 'source-tunai',
    name: 'Tunai',
    kind,
    opening_balance: 1500000,
    as_of: '2026-05-01',
    order: 0,
    archived_at: null,
    household_id: 'household-001',
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
      id: 'source-tunai',
      name: 'Tunai',
      kind: 'cash',
      openingBalance: 1500000,
      asOf: '2026-05-01',
      order: 0,
      archivedAt: null,
      householdId: 'household-001',
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
