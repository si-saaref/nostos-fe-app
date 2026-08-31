import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { entityKey } from '@/api/keys'
import type { Paginated } from '@/types/api'
import type {
  CreateExpenseInput,
  Expense,
  ExpenseFilters,
} from '@/types/expense'

/**
 * Everything Expense knows about the server, in one file: the key factory, the
 * read, and every write. Colocated on purpose — when the three writes sit on
 * one screen, a mutation that invalidates a key nobody reads is visible, and a
 * cache strategy that only one of them implements cannot quietly diverge.
 */
export const expenseKeys = {
  all: (householdId: string) => entityKey(householdId, 'expenses'),
  lists: (householdId: string) =>
    [...entityKey(householdId, 'expenses'), 'list'] as const,
  list: (householdId: string, filters?: ExpenseFilters) =>
    [...entityKey(householdId, 'expenses'), 'list', filters ?? {}] as const,
  detail: (householdId: string, id: string) =>
    [...entityKey(householdId, 'expenses'), 'detail', id] as const,
}

/** Index of the filters object inside a `list` key, used to match cache writes. */
const FILTERS_IN_KEY = 4

/**
 * The wire shape, written out rather than spreading the filter object straight
 * into axios. The internal names and the query names have drifted apart once
 * already (`sortOrder` vs `order`), and a silent mismatch there reads as a
 * control that works and does nothing.
 */
const toRequestParams = (filters?: ExpenseFilters) => {
  if (!filters) return undefined
  const params: Record<string, string | number> = {
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }
  if (filters.dateFrom) params.dateFrom = filters.dateFrom
  if (filters.dateTo) params.dateTo = filters.dateTo
  if (filters.typeId) params.typeId = filters.typeId
  if (filters.sourceId) params.sourceId = filters.sourceId
  if (filters.paidByUserId) params.paidByUserId = filters.paidByUserId
  if (filters.search) params.search = filters.search
  return params
}

/** Would the server have returned this row for these filters? */
const matchesFilters = (expense: Expense, filters: ExpenseFilters): boolean => {
  if (filters.dateFrom && expense.datePaid < filters.dateFrom) return false
  if (filters.dateTo && expense.datePaid > filters.dateTo) return false
  if (filters.typeId && expense.typeId !== filters.typeId) return false
  if (filters.sourceId && expense.sourceId !== filters.sourceId) return false
  if (filters.paidByUserId && expense.paidByUserId !== filters.paidByUserId) {
    return false
  }
  if (
    filters.search &&
    !expense.name.toLowerCase().includes(filters.search.toLowerCase())
  ) {
    return false
  }
  return true
}

/**
 * Aggregates are filter-scoped, so an optimistic row has to move them too —
 * a tape that gains an entry while the header total sits still is worse than
 * one that waits for the server.
 */
const withRow = (
  page: Paginated<Expense>,
  expense: Expense,
): Paginated<Expense> => {
  const count = (page.totals?.count ?? page.items.length) + 1
  const sum = (page.totals?.sum ?? 0) + expense.value
  return {
    ...page,
    items: [expense, ...page.items],
    pagination: { ...page.pagination, total: page.pagination.total + 1 },
    totals: page.totals
      ? { sum, count, average: Math.round(sum / count) }
      : undefined,
  }
}

const withoutRow = (
  page: Paginated<Expense>,
  id: string,
): Paginated<Expense> => {
  const removed = page.items.find((item) => item.id === id)
  if (!removed) return page
  const count = Math.max(0, (page.totals?.count ?? page.items.length) - 1)
  const sum = Math.max(0, (page.totals?.sum ?? 0) - removed.value)
  return {
    ...page,
    items: page.items.filter((item) => item.id !== id),
    pagination: {
      ...page.pagination,
      total: Math.max(0, page.pagination.total - 1),
    },
    totals: page.totals
      ? { sum, count, average: count ? Math.round(sum / count) : 0 }
      : undefined,
  }
}

const OPTIMISTIC_PREFIX = 'optimistic-'

/** A row the server has not acknowledged yet: it has no id anything can act on. */
export const isOptimisticId = (id: string): boolean =>
  id.startsWith(OPTIMISTIC_PREFIX)

export const useExpenses = (householdId: string, filters?: ExpenseFilters) =>
  useQuery({
    queryKey: expenseKeys.list(householdId, filters),
    queryFn: async () => {
      const res = await apiClient.get<Paginated<Expense>>('/expenses', {
        params: toRequestParams(filters),
      })
      return res.data
    },
    enabled: Boolean(householdId),
  })

export const useCreateExpense = (householdId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      const res = await apiClient.post<Expense>('/expenses', input)
      return res.data
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: expenseKeys.lists(householdId),
      })
      const previous = queryClient.getQueriesData<Paginated<Expense>>({
        queryKey: expenseKeys.lists(householdId),
      })
      const optimistic: Expense = {
        id: `${OPTIMISTIC_PREFIX}${crypto.randomUUID()}`,
        householdId,
        ...input,
      }
      // Only into caches the row actually belongs to. A list scoped to last
      // month, or to another category, must not sprout today's entry.
      previous.forEach(([key, data]) => {
        if (!data) return
        const filters = key[FILTERS_IN_KEY] as ExpenseFilters | undefined
        if (filters && !matchesFilters(optimistic, filters)) return
        queryClient.setQueryData<Paginated<Expense>>(
          key,
          withRow(data, optimistic),
        )
      })
      return { previous }
    },
    onError: (_error, _input, context) => {
      context?.previous?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all(householdId) })
    },
  })
}

export const useDeleteExpense = (householdId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/expenses/${id}`)
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: expenseKeys.lists(householdId),
      })
      const previous = queryClient.getQueriesData<Paginated<Expense>>({
        queryKey: expenseKeys.lists(householdId),
      })
      previous.forEach(([key, data]) => {
        if (!data) return
        queryClient.setQueryData<Paginated<Expense>>(key, withoutRow(data, id))
      })
      return { previous }
    },
    onError: (_error, _id, context) => {
      context?.previous?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all(householdId) })
    },
  })
}
