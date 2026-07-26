import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { EXPENSE_KEYS } from '@/api/queries/expenses'
import { useCreateExpense } from '@/api/mutations/useCreateExpense'
import type { CreateExpenseInput, Expense, Paginated } from '@/types/expense'

const HOUSEHOLD_ID = 'household-001'

describe('useCreateExpense', () => {
  it('optimistically updates list caches without corrupting cached detail entries', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    // Simulate a cached detail view (bare `Expense`, not `Paginated<Expense>`) —
    // this shares the ['expenses', householdId] prefix with list caches.
    const cachedDetail: Expense = {
      id: 'exp-001',
      name: 'Weekly groceries',
      value: 150000,
      typeId: 'type-groceries',
      sourceId: 'source-card',
      datePaid: '2026-07-20',
      paidByUserId: 'user-001',
      householdId: HOUSEHOLD_ID,
    }
    client.setQueryData(EXPENSE_KEYS.detail(HOUSEHOLD_ID, 'exp-001'), cachedDetail)

    // Seed a list cache entry so the optimistic update has something to prepend to.
    const emptyList: Paginated<Expense> = {
      items: [],
      pagination: { total: 0, page: 1, pages: 1 },
    }
    client.setQueryData(EXPENSE_KEYS.list(HOUSEHOLD_ID), emptyList)

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    )

    const { result } = renderHook(() => useCreateExpense(HOUSEHOLD_ID), {
      wrapper,
    })

    const input: CreateExpenseInput = {
      name: 'New expense',
      value: 50000,
      typeId: 'type-groceries',
      sourceId: 'source-card',
      datePaid: '2026-07-25',
      paidByUserId: 'user-001',
    }

    await act(async () => {
      await result.current.mutateAsync(input)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const list = client.getQueryData<Paginated<Expense>>(
      EXPENSE_KEYS.list(HOUSEHOLD_ID),
    )
    expect(list?.items.length).toBe(1)

    const detail = client.getQueryData<Expense>(
      EXPENSE_KEYS.detail(HOUSEHOLD_ID, 'exp-001'),
    )
    expect(detail).toEqual(cachedDetail)
    expect((detail as unknown as Paginated<Expense>).items).toBeUndefined()
  })
})
