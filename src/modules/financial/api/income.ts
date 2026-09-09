import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, unwrap, unwrapPage } from '@/api/client'
import { entityKey } from '@/api/keys'
import { averageMoney, roundMoney } from '@/utils/money'
import type { ApiEnvelope, Paginated } from '@/types/api'
import type {
  CreateIncomeInput,
  Income,
  IncomeFilters,
  UpdateIncomeInput,
  WireIncome,
} from '@/types/income'

/**
 * Everything Income knows about the server, in one file — see `expenses.ts`
 * for why the key factory and all four writes are colocated.
 *
 * Income is household-scoped in the *path* rather than only in the header
 * (`PATCH /households/:id/income/:incomeId`, PRD AC3.4), unlike `/expenses`.
 * The header still goes out, because tenant scoping is not the client's to
 * decide — this is just the shape the income routes were specified in.
 */
export const incomeKeys = {
  all: (householdId: string) => entityKey(householdId, 'income'),
  lists: (householdId: string) =>
    [...entityKey(householdId, 'income'), 'list'] as const,
  list: (householdId: string, filters?: IncomeFilters) =>
    [...entityKey(householdId, 'income'), 'list', filters ?? {}] as const,
}

/** The widest page the route accepts. More is a `400`, not a truncation. */
export const MAX_PAGE_SIZE = 500

/** Index of the filters object inside a `list` key, used to match cache writes. */
const FILTERS_IN_KEY = 4

const basePath = (householdId: string) => `/households/${householdId}/income`

const toRequestParams = (filters?: IncomeFilters) => {
  if (!filters) return undefined
  const params: Record<string, string | number> = {
    page: filters.page,
    limit: filters.limit,
  }
  if (filters.dateFrom) params.date_from = filters.dateFrom
  if (filters.dateTo) params.date_to = filters.dateTo
  return params
}

/** Wire → domain. The only place a snake_case income key is spelled out. */
export const toIncome = (row: WireIncome): Income => ({
  id: row.id,
  name: row.name,
  amount: row.amount,
  type: row.type,
  fromSourceId: row.from_source_id,
  toSourceId: row.to_source_id,
  date: row.date,
  householdId: row.household_id,
  createdByUserId: row.created_by_user_id,
  updatedByAdminId: row.updated_by_admin_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

/**
 * Domain → wire for the create body.
 *
 * `from_source_id` is sent even when it is `null`, because on this field null
 * is a value and not an omission: it is how "the money came from outside the
 * household" is spelled, and leaving the key out would ask the server to guess.
 */
const toIncomeBody = (input: CreateIncomeInput) => ({
  name: input.name,
  amount: input.amount,
  type: input.type,
  from_source_id: input.fromSourceId,
  to_source_id: input.toSourceId,
  date: input.date,
})

/**
 * Domain → wire for a PATCH, three-way (AC3.4): absent leaves it alone, a
 * value writes it, `null` clears it.
 *
 * Only `fromSourceId` can legally be cleared, and the `!== undefined` test is
 * what preserves that — a truthiness check would silently drop the null and
 * turn "this was not a transfer after all" into a no-op.
 *
 * `amount` goes out exactly as typed, deliberately unrounded: rounding here
 * would turn `10.999` into `11.00` on its way out and make the server's own
 * precision check unreachable. The form rejects it, the server rejects it,
 * nothing quietly fixes it.
 */
const toIncomePatch = (patch: UpdateIncomeInput) => {
  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.name = patch.name
  if (patch.amount !== undefined) body.amount = patch.amount
  if (patch.type !== undefined) body.type = patch.type
  if (patch.fromSourceId !== undefined) {
    body.from_source_id = patch.fromSourceId
  }
  if (patch.toSourceId !== undefined) body.to_source_id = patch.toSourceId
  if (patch.date !== undefined) body.date = patch.date
  return body
}

/** Would the server have returned this row for these filters? */
const matchesFilters = (income: Income, filters: IncomeFilters): boolean => {
  if (filters.dateFrom && income.date < filters.dateFrom) return false
  if (filters.dateTo && income.date > filters.dateTo) return false
  return true
}

/**
 * What one row contributes to `totals.sum`.
 *
 * Zero for a transfer, and that is the whole point: the sum is net inflow, so
 * money that only moved between the household's own sources must not shift it.
 * An optimistic transfer that bumped the total would be a wrong number on
 * screen for as long as the request took.
 */
const netContribution = (income: Income): number =>
  income.fromSourceId === null ? income.amount : 0

const withRow = (
  page: Paginated<Income>,
  income: Income,
): Paginated<Income> => {
  const count = (page.totals?.count ?? page.items.length) + 1
  const sum = roundMoney((page.totals?.sum ?? 0) + netContribution(income))
  return {
    ...page,
    items: [income, ...page.items],
    pagination: { ...page.pagination, total: page.pagination.total + 1 },
    totals: page.totals
      ? { sum, count, average: averageMoney(sum, count) }
      : undefined,
  }
}

const withoutRow = (page: Paginated<Income>, id: string): Paginated<Income> => {
  const removed = page.items.find((item) => item.id === id)
  if (!removed) return page
  const count = Math.max(0, (page.totals?.count ?? page.items.length) - 1)
  // No `Math.max(0, …)` on the sum: net inflow is a signed quantity, and
  // clamping it would report a comfortable zero for a month that is genuinely
  // negative.
  const sum = roundMoney((page.totals?.sum ?? 0) - netContribution(removed))
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

/** A row the server has not acknowledged: it has no id anything can act on. */
export const isOptimisticId = (id: string): boolean =>
  id.startsWith(OPTIMISTIC_PREFIX)

export const useIncome = (householdId: string, filters?: IncomeFilters) =>
  useQuery({
    queryKey: incomeKeys.list(householdId, filters),
    queryFn: async () =>
      unwrapPage(
        await apiClient.get<ApiEnvelope<WireIncome[]>>(basePath(householdId), {
          params: toRequestParams(filters),
        }),
        toIncome,
      ),
    enabled: Boolean(householdId),
  })

/**
 * Create is open to every member — the permission matrix gates update and
 * delete, not recording money that arrived.
 *
 * Position is invalidated alongside the list: a balance is derived from these
 * rows, so a new entry that left the position card sitting on its old figure
 * would contradict the row it just added.
 */
export const useCreateIncome = (householdId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateIncomeInput) =>
      toIncome(
        unwrap(
          await apiClient.post<ApiEnvelope<WireIncome>>(
            basePath(householdId),
            toIncomeBody(input),
          ),
        ),
      ),
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: incomeKeys.lists(householdId),
      })
      const previous = queryClient.getQueriesData<Paginated<Income>>({
        queryKey: incomeKeys.lists(householdId),
      })
      const optimistic: Income = {
        id: `${OPTIMISTIC_PREFIX}${crypto.randomUUID()}`,
        householdId,
        ...input,
      }
      // Only into caches the row actually belongs to: a list scoped to last
      // month must not sprout today's entry.
      previous.forEach(([key, data]) => {
        if (!data) return
        const filters = key[FILTERS_IN_KEY] as IncomeFilters | undefined
        if (filters && !matchesFilters(optimistic, filters)) return
        queryClient.setQueryData<Paginated<Income>>(
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
      queryClient.invalidateQueries({ queryKey: incomeKeys.all(householdId) })
      queryClient.invalidateQueries({
        queryKey: entityKey(householdId, 'positions'),
      })
    },
  })
}

/**
 * Correct a row already on the statement. Admin only, per the permission
 * matrix — members record what arrived, admins fix history.
 *
 * Invalidating rather than writing optimistically, for the same reason as
 * expenses: an edit can move a row out of the month it is rendered under, and
 * a wrong optimistic guess shows the row jumping to a place it does not stay.
 */
export const useUpdateIncome = (householdId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & UpdateIncomeInput) =>
      toIncome(
        unwrap(
          await apiClient.patch<ApiEnvelope<WireIncome>>(
            `${basePath(householdId)}/${id}`,
            toIncomePatch(patch),
          ),
        ),
      ),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: incomeKeys.all(householdId) })
      queryClient.invalidateQueries({
        queryKey: entityKey(householdId, 'positions'),
      })
    },
  })
}

export const useDeleteIncome = (householdId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${basePath(householdId)}/${id}`)
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: incomeKeys.lists(householdId),
      })
      const previous = queryClient.getQueriesData<Paginated<Income>>({
        queryKey: incomeKeys.lists(householdId),
      })
      previous.forEach(([key, data]) => {
        if (!data) return
        queryClient.setQueryData<Paginated<Income>>(key, withoutRow(data, id))
      })
      return { previous }
    },
    onError: (_error, _id, context) => {
      context?.previous?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: incomeKeys.all(householdId) })
      queryClient.invalidateQueries({
        queryKey: entityKey(householdId, 'positions'),
      })
    },
  })
}
