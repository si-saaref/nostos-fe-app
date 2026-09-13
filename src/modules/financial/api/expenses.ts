import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, unwrap, unwrapPage } from '@/api/client'
import { entityKey } from '@/api/keys'
import { averageMoney, roundMoney } from '@/utils/money'
import type { ApiEnvelope, Paginated } from '@/types/api'
import type {
  CreateExpenseInput,
  Expense,
  ExpenseFilters,
  ExpenseSortField,
  UpdateExpenseInput,
  WireExpense,
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

/**
 * The widest page the list route accepts (§3.4). More is a `400`, not a
 * truncation — ask for 1000 and you get nothing.
 */
export const MAX_PAGE_SIZE = 500

/** Index of the filters object inside a `list` key, used to match cache writes. */
const FILTERS_IN_KEY = 4

/**
 * The wire's own name for each sortable column. The domain calls it
 * `datePaid`, the browser URL calls it `datePaid`, and the API calls it
 * `date_paid` — three names for one thing, so the last hop is a lookup rather
 * than a string transform that would also happily "translate" a typo.
 */
const SORT_COLUMN: Record<ExpenseSortField, string> = {
  datePaid: 'date_paid',
  value: 'value',
  name: 'name',
}

/**
 * The wire shape, written out rather than spreading the filter object straight
 * into axios. The internal names and the query names have drifted apart once
 * already (`sortOrder` vs `order`), and a silent mismatch there reads as a
 * control that works and does nothing.
 *
 * Every key is snake_case and `sort_order` is upper-cased, because those are
 * the API's documented values — `desc` is not one of them, and a server that
 * falls back to its default on an unrecognised direction would make the sort
 * control look functional while ignoring it.
 */
const toRequestParams = (filters?: ExpenseFilters) => {
  if (!filters) return undefined
  const params: Record<string, string | number> = {
    page: filters.page,
    limit: filters.limit,
    sort_by: SORT_COLUMN[filters.sortBy],
    sort_order: filters.sortOrder.toUpperCase(),
  }
  if (filters.dateFrom) params.date_from = filters.dateFrom
  if (filters.dateTo) params.date_to = filters.dateTo
  if (filters.typeId) params.type_id = filters.typeId
  if (filters.sourceId) params.source_id = filters.sourceId
  if (filters.paidByUserId) params.paid_by_user_id = filters.paidByUserId
  if (filters.search) params.search = filters.search
  return params
}

/** Wire → domain. The only place a snake_case expense key is spelled out. */
export const toExpense = (row: WireExpense): Expense => ({
  id: row.id,
  name: row.name,
  description: row.description,
  value: row.value,
  typeId: row.type_id,
  sourceId: row.source_id,
  datePaid: row.date_paid,
  paidByUserId: row.paid_by_user_id,
  householdId: row.household_id,
  createdByUserId: row.created_by_user_id,
  updatedByAdminId: row.updated_by_admin_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

/** Domain → wire, for the create body. */
const toExpenseBody = (input: CreateExpenseInput) => ({
  name: input.name,
  // Blank is absent. The server coerces `''` to `null` anyway, but sending
  // the empty string would make "" and null both reachable from here.
  description: input.description?.trim() || null,
  value: input.value,
  type_id: input.typeId,
  source_id: input.sourceId,
  date_paid: input.datePaid,
  paid_by_user_id: input.paidByUserId,
})

/**
 * Domain → wire for a PATCH. Only the keys the caller actually passed are
 * written: under PATCH an absent key means "leave it alone", so spreading a
 * fixed shape would send `undefined` for every field the admin did not touch.
 *
 * `value` goes out exactly as typed — deliberately not rounded here. Rounding
 * at this boundary would turn `10.999` into `11.00` on its way out, charging a
 * member an amount they did not enter and making the server's own precision
 * check unreachable. The form rejects it, the server rejects it, nothing
 * quietly fixes it.
 */
const toExpensePatch = (patch: UpdateExpenseInput) => {
  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.name = patch.name
  // `null` clears it; the server treats a blank string as a clear too, and
  // normalising here keeps the two spellings from both being reachable.
  if (patch.description !== undefined) {
    body.description = patch.description?.trim() || null
  }
  if (patch.value !== undefined) body.value = patch.value
  if (patch.typeId !== undefined) body.type_id = patch.typeId
  if (patch.sourceId !== undefined) body.source_id = patch.sourceId
  if (patch.datePaid !== undefined) body.date_paid = patch.datePaid
  if (patch.paidByUserId !== undefined) {
    body.paid_by_user_id = patch.paidByUserId
  }
  return body
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
  const sum = roundMoney((page.totals?.sum ?? 0) + expense.value)
  return {
    ...page,
    items: [expense, ...page.items],
    pagination: { ...page.pagination, total: page.pagination.total + 1 },
    totals: page.totals
      ? { sum, count, average: averageMoney(sum, count) }
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
  const sum = Math.max(0, roundMoney((page.totals?.sum ?? 0) - removed.value))
  return {
    ...page,
    items: page.items.filter((item) => item.id !== id),
    pagination: {
      ...page.pagination,
      total: Math.max(0, page.pagination.total - 1),
    },
    totals: page.totals
      ? { sum, count, average: averageMoney(sum, count) }
      : undefined,
  }
}

const OPTIMISTIC_PREFIX = 'optimistic-'

/** A row the server has not acknowledged yet: it has no id anything can act on. */
export const isOptimisticId = (id: string): boolean =>
  id.startsWith(OPTIMISTIC_PREFIX)

/**
 * `options.enabled` is how a caller retires its own request. Several figures
 * on the ledger were bought with a second and third `/expenses` because the
 * list route could not answer them; each of those callers now switches itself
 * off the moment `meta.summary` carries the answer instead.
 */
export const useExpenses = (
  householdId: string,
  filters?: ExpenseFilters,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: expenseKeys.list(householdId, filters),
    queryFn: async () =>
      unwrapPage(
        await apiClient.get<ApiEnvelope<WireExpense[]>>('/expenses', {
          params: toRequestParams(filters),
        }),
        toExpense,
      ),
    enabled: Boolean(householdId) && (options?.enabled ?? true),
  })

export const useCreateExpense = (householdId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateExpenseInput) =>
      toExpense(
        unwrap(
          await apiClient.post<ApiEnvelope<WireExpense>>(
            '/expenses',
            toExpenseBody(input),
          ),
        ),
      ),
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

/**
 * Correct a row already on the tape. Admin-only, per the permission matrix —
 * members record what they paid for, admins fix history.
 *
 * Invalidating rather than writing optimistically, unlike create and delete.
 * An edit can move a row out of the filters it is currently rendered under —
 * change the date and it belongs to another month, change the category and it
 * leaves the filtered view — so the honest answer to "where does this row
 * belong now" is the server's. A wrong optimistic guess would show the row
 * jumping to a place it does not stay.
 */
export const useUpdateExpense = (householdId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & UpdateExpenseInput) =>
      toExpense(
        unwrap(
          await apiClient.patch<ApiEnvelope<WireExpense>>(
            `/expenses/${id}`,
            toExpensePatch(patch),
          ),
        ),
      ),
    onSuccess: (updated) => {
      // The detail cache can be refreshed for free from the response body.
      queryClient.setQueryData(
        expenseKeys.detail(householdId, updated.id),
        updated,
      )
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
