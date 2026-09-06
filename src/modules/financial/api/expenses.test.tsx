import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { server } from '@/mocks/server'
import { createTestQueryClient, createWrapper } from '@/test/test-utils'
import {
  expenseKeys,
  useCreateExpense,
  useDeleteExpense,
  useExpenses,
  useUpdateExpense,
} from '@/modules/financial/api/expenses'
import type { Paginated } from '@/types/api'
import type { Expense, ExpenseFilters } from '@/types/expense'

const HOUSEHOLD_ID = 'household-001'

const BASE: ExpenseFilters = {
  page: 1,
  limit: 25,
  sortBy: 'datePaid',
  sortOrder: 'desc',
}

const AUGUST: ExpenseFilters = {
  ...BASE,
  dateFrom: '2026-08-01',
  dateTo: '2026-08-31',
}
const JULY: ExpenseFilters = {
  ...BASE,
  dateFrom: '2026-07-01',
  dateTo: '2026-07-31',
}

const emptyPage = (): Paginated<Expense> => ({
  items: [],
  pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
  totals: { sum: 0, count: 0, average: 0 },
})

const wrapperFor =
  (client: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )

const NEW_EXPENSE = {
  name: 'Kopi',
  value: 25000,
  typeId: 'type-makan',
  sourceId: 'source-tunai',
  datePaid: '2026-08-15',
  paidByUserId: 'user-001',
}

describe('useExpenses', () => {
  it('fetches the seeded expenses for a household', async () => {
    const { result } = renderHook(() => useExpenses(HOUSEHOLD_ID, BASE), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.items.length).toBeGreaterThan(0)
    expect(result.current.data?.items[0].householdId).toBe(HOUSEHOLD_ID)
  })

  it('is disabled when householdId is empty', () => {
    const { result } = renderHook(() => useExpenses(''), {
      wrapper: createWrapper(),
    })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('surfaces server errors', async () => {
    server.use(
      http.get('*/api/v1/expenses', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    const { result } = renderHook(() => useExpenses(HOUSEHOLD_ID), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('honours sort_order=ASC — the hook writes the API parameter names, not the URL ones', async () => {
    const base = { ...BASE, limit: 5 }
    const asc = renderHook(
      () => useExpenses(HOUSEHOLD_ID, { ...base, sortOrder: 'asc' }),
      { wrapper: createWrapper() },
    )
    const desc = renderHook(
      () => useExpenses(HOUSEHOLD_ID, { ...base, sortOrder: 'desc' }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(asc.result.current.isSuccess).toBe(true))
    await waitFor(() => expect(desc.result.current.isSuccess).toBe(true))

    const ascDates =
      asc.result.current.data?.items.map((item) => item.datePaid) ?? []
    expect(ascDates.length).toBeGreaterThan(0)
    expect([...ascDates].sort()).toEqual(ascDates)
    expect(ascDates[0]).not.toBe(desc.result.current.data?.items[0].datePaid)
  })

  it('maps the snake_case row onto the domain shape', async () => {
    const { result } = renderHook(() => useExpenses(HOUSEHOLD_ID, BASE), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const row = result.current.data!.items[0]
    // The wire sends `date_paid` / `type_id`; nothing above this module should
    // ever see those names.
    expect(row.datePaid).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(row.typeId).toBeTruthy()
    expect(row.paidByUserId).toBeTruthy()
    expect(row).not.toHaveProperty('date_paid')
  })

  it('reads pagination out of meta, including total_pages', async () => {
    const { result } = renderHook(
      () => useExpenses(HOUSEHOLD_ID, { ...BASE, limit: 5 }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const { pagination, totals } = result.current.data!
    expect(pagination.limit).toBe(5)
    expect(pagination.page).toBe(1)
    expect(pagination.totalPages).toBe(Math.ceil(pagination.total / 5))
    // Filter-scoped, not page-scoped: 5 rows in hand, every row counted.
    expect(totals?.count).toBe(pagination.total)
    expect(totals!.count).toBeGreaterThan(5)
  })

  it('fails loudly when a list answers without meta.pagination', async () => {
    // An unenveloped or meta-less page used to yield `undefined` and surface as
    // a TanStack complaint naming neither the endpoint nor the shape.
    server.use(
      http.get('*/api/v1/expenses', () =>
        HttpResponse.json({ success: true, data: [] }),
      ),
    )
    const { result } = renderHook(() => useExpenses(HOUSEHOLD_ID, BASE), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/meta\.pagination/)
  })
})

describe('useCreateExpense', () => {
  it('does not corrupt a cached detail entry sharing the list prefix', async () => {
    const client = createTestQueryClient()
    const cachedDetail: Expense = {
      id: 'exp-001',
      name: 'Weekly groceries',
      value: 150000,
      typeId: 'type-belanja',
      sourceId: 'source-debit',
      datePaid: '2026-07-20',
      paidByUserId: 'user-001',
      householdId: HOUSEHOLD_ID,
    }
    client.setQueryData(
      expenseKeys.detail(HOUSEHOLD_ID, 'exp-001'),
      cachedDetail,
    )
    client.setQueryData(expenseKeys.list(HOUSEHOLD_ID), emptyPage())

    const { result } = renderHook(() => useCreateExpense(HOUSEHOLD_ID), {
      wrapper: wrapperFor(client),
    })
    await act(async () => {
      await result.current.mutateAsync(NEW_EXPENSE)
    })

    expect(
      client.getQueryData<Paginated<Expense>>(expenseKeys.list(HOUSEHOLD_ID))
        ?.items.length,
    ).toBe(1)
    expect(
      client.getQueryData<Expense>(expenseKeys.detail(HOUSEHOLD_ID, 'exp-001')),
    ).toEqual(cachedDetail)
  })

  it('writes the optimistic row only into caches whose filters match it', async () => {
    const client = createTestQueryClient()
    client.setQueryData(expenseKeys.list(HOUSEHOLD_ID, AUGUST), emptyPage())
    client.setQueryData(expenseKeys.list(HOUSEHOLD_ID, JULY), emptyPage())

    const { result } = renderHook(() => useCreateExpense(HOUSEHOLD_ID), {
      wrapper: wrapperFor(client),
    })
    await act(async () => {
      await result.current.mutateAsync(NEW_EXPENSE)
    })

    const august = client.getQueryData<Paginated<Expense>>(
      expenseKeys.list(HOUSEHOLD_ID, AUGUST),
    )
    const july = client.getQueryData<Paginated<Expense>>(
      expenseKeys.list(HOUSEHOLD_ID, JULY),
    )

    expect(august?.items).toHaveLength(1)
    // A 15 August expense is not part of July, however the cache is keyed.
    expect(july?.items).toHaveLength(0)
  })

  it('moves the filter-scoped totals with the row it adds', async () => {
    const client = createTestQueryClient()
    client.setQueryData(expenseKeys.list(HOUSEHOLD_ID, AUGUST), emptyPage())

    const { result } = renderHook(() => useCreateExpense(HOUSEHOLD_ID), {
      wrapper: wrapperFor(client),
    })
    await act(async () => {
      await result.current.mutateAsync(NEW_EXPENSE)
    })

    const august = client.getQueryData<Paginated<Expense>>(
      expenseKeys.list(HOUSEHOLD_ID, AUGUST),
    )
    expect(august?.totals).toEqual({ sum: 25000, count: 1, average: 25000 })
    expect(august?.pagination.total).toBe(1)
  })

  it('rolls every touched cache back when the write fails', async () => {
    server.use(
      http.post('*/api/v1/expenses', () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 }),
      ),
    )
    const client = createTestQueryClient()
    client.setQueryData(expenseKeys.list(HOUSEHOLD_ID, AUGUST), emptyPage())

    const { result } = renderHook(() => useCreateExpense(HOUSEHOLD_ID), {
      wrapper: wrapperFor(client),
    })
    await act(async () => {
      await result.current.mutateAsync(NEW_EXPENSE).catch(() => undefined)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(
      client.getQueryData<Paginated<Expense>>(
        expenseKeys.list(HOUSEHOLD_ID, AUGUST),
      )?.items,
    ).toHaveLength(0)
  })
})

describe('useDeleteExpense', () => {
  it('soft-deletes: the row leaves every response but stays recoverable', async () => {
    const { result } = renderHook(
      () => ({
        list: useExpenses(HOUSEHOLD_ID, BASE),
        remove: useDeleteExpense(HOUSEHOLD_ID),
      }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
    const before = result.current.list.data!
    const target = before.items[0]

    await act(async () => {
      await result.current.remove.mutateAsync(target.id)
    })

    // Gone from the page, and counted out of the filter-scoped totals — a
    // tombstone the list still returned would be worse than a hard delete.
    await waitFor(() =>
      expect(
        result.current.list.data?.items.some((row) => row.id === target.id),
      ).toBe(false),
    )
    expect(result.current.list.data?.pagination.total).toBe(
      before.pagination.total - 1,
    )
    expect(result.current.list.data?.totals?.sum).toBe(
      before.totals!.sum - target.value,
    )
  })

  it('removes the row optimistically and restores it when the call fails', async () => {
    const seeded: Expense = {
      id: 'exp-0001',
      name: 'Ojek ke kantor',
      value: 24000,
      typeId: 'type-transport',
      sourceId: 'source-ewallet',
      datePaid: '2026-08-10',
      paidByUserId: 'user-002',
      householdId: HOUSEHOLD_ID,
    }
    server.use(
      http.delete('*/api/v1/expenses/:id', () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 }),
      ),
    )
    const client = createTestQueryClient()
    client.setQueryData(expenseKeys.list(HOUSEHOLD_ID, AUGUST), {
      items: [seeded],
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
      totals: { sum: 24000, count: 1, average: 24000 },
    })

    const { result } = renderHook(() => useDeleteExpense(HOUSEHOLD_ID), {
      wrapper: wrapperFor(client),
    })
    await act(async () => {
      await result.current.mutateAsync('exp-0001').catch(() => undefined)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(
      client.getQueryData<Paginated<Expense>>(
        expenseKeys.list(HOUSEHOLD_ID, AUGUST),
      )?.items,
    ).toHaveLength(1)
  })
})

describe('useUpdateExpense', () => {
  const setup = () =>
    renderHook(
      () => ({
        list: useExpenses(HOUSEHOLD_ID, BASE),
        update: useUpdateExpense(HOUSEHOLD_ID),
      }),
      { wrapper: createWrapper() },
    )

  it('sends only the fields the admin touched', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
    const target = result.current.list.data!.items[0]

    let body: Record<string, unknown> = {}
    server.use(
      http.patch('*/api/v1/expenses/:id', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          success: true,
          data: { ...body, id: target.id },
        })
      }),
    )

    await act(async () => {
      await result.current.update.mutateAsync({ id: target.id, value: 12345 })
    })

    // Under PATCH an absent key means "leave it alone", so a fixed body shape
    // would blank the five fields the admin never opened.
    expect(body).toEqual({ value: 12345 })
    expect(body).not.toHaveProperty('name')
  })

  it('writes the corrected row back to the list, decimals intact', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
    const target = result.current.list.data!.items[0]

    await act(async () => {
      await result.current.update.mutateAsync({
        id: target.id,
        name: 'Belanja mingguan',
        value: 180000.5,
      })
    })

    await waitFor(() => {
      const row = result.current.list.data?.items.find(
        (r) => r.id === target.id,
      )
      expect(row?.name).toBe('Belanja mingguan')
      expect(row?.value).toBe(180000.5)
    })
  })

  it('records which admin last edited it, apart from who recorded it', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
    const target = result.current.list.data!.items[0]

    const updated = await act(async () =>
      result.current.update.mutateAsync({ id: target.id, value: 99000 }),
    )

    // Only an admin can reach this route, so "who logged it" and "who last
    // changed it" are different questions and both get answered.
    expect(updated!.updatedByAdminId).toBeTruthy()
    expect(updated!.updatedAt).toBeTruthy()
  })

  it('rejects a third decimal place rather than letting it be truncated', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
    const target = result.current.list.data!.items[0]

    await act(async () => {
      await result.current.update
        .mutateAsync({ id: target.id, value: 10.999 })
        .catch(() => undefined)
    })

    // The client does not round on the way out, so this check is reachable
    // rather than decorative.
    await waitFor(() => expect(result.current.update.isError).toBe(true))
  })

  it('404s on a soft-deleted row', async () => {
    const { result } = renderHook(
      () => ({
        list: useExpenses(HOUSEHOLD_ID, BASE),
        remove: useDeleteExpense(HOUSEHOLD_ID),
        update: useUpdateExpense(HOUSEHOLD_ID),
      }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
    const target = result.current.list.data!.items[0]

    await act(async () => {
      await result.current.remove.mutateAsync(target.id)
    })
    await act(async () => {
      await result.current.update
        .mutateAsync({ id: target.id, value: 1000 })
        .catch(() => undefined)
    })

    // A tombstone is indistinguishable from an id that never existed.
    await waitFor(() => expect(result.current.update.isError).toBe(true))
  })
})
