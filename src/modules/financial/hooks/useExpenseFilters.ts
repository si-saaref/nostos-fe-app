import { useSearchParams } from 'react-router-dom'
import { useExpenses } from '@/api/queries/expenses'
import { monthRange } from '@/utils/dates'
import type { ExpenseFilters } from '@/types/expense'

const PARAM_MAP: Record<keyof ExpenseFilters, string> = {
  dateFrom: 'dateFrom',
  dateTo: 'dateTo',
  typeId: 'type',
  sourceId: 'source',
  paidByUserId: 'paidBy',
  search: 'q',
  page: 'page',
  limit: 'limit',
  sortBy: 'sortBy',
  sortOrder: 'order',
}

/**
 * The default view is the current month. It is written into the filters rather
 * than left implicit, because the count strip prints the scope it is counting
 * and a filter-scoped total with an unstated range misreports silently.
 */
const parseFilters = (params: URLSearchParams): ExpenseFilters => {
  const thisMonth = monthRange(new Date())
  return {
    dateFrom: params.get('dateFrom') ?? thisMonth.from,
    dateTo: params.get('dateTo') ?? thisMonth.to,
    typeId: params.get('type') ?? undefined,
    sourceId: params.get('source') ?? undefined,
    paidByUserId: params.get('paidBy') ?? undefined,
    search: params.get('q') ?? undefined,
    page: Number(params.get('page') ?? '1'),
    // The tape is continuous rather than paginated, so one page holds a month.
    limit: Number(params.get('limit') ?? '400'),
    sortBy: params.get('sortBy') ?? 'datePaid',
    sortOrder: (params.get('order') as 'asc' | 'desc' | null) ?? 'desc',
  }
}

export const useExpenseFilters = (householdId: string) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = parseFilters(searchParams)
  const query = useExpenses(householdId, filters)

  const updateFilters = (next: Partial<ExpenseFilters>) => {
    const merged: ExpenseFilters = { ...filters, ...next }
    const params = new URLSearchParams()
    ;(Object.keys(PARAM_MAP) as (keyof ExpenseFilters)[]).forEach((key) => {
      const value = merged[key]
      if (value !== undefined && value !== '' && value !== null) {
        params.set(PARAM_MAP[key], String(value))
      }
    })
    setSearchParams(params)
  }

  const clearFilters = () => setSearchParams(new URLSearchParams())

  /** True when anything narrows the view beyond the plain month range. */
  const isNarrowed = Boolean(
    filters.typeId ||
    filters.sourceId ||
    filters.paidByUserId ||
    filters.search,
  )

  return { filters, updateFilters, clearFilters, isNarrowed, ...query }
}
