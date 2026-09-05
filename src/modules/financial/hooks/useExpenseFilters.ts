import { useSearchParams } from 'react-router-dom'
import { useExpenses } from '@/modules/financial/api/expenses'
import { monthRange } from '@/utils/dates'
import type {
  ExpenseFilters,
  ExpenseSortField,
  SortDirection,
} from '@/types/expense'

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

const SORT_FIELDS: ExpenseSortField[] = ['datePaid', 'value', 'name']

/**
 * The URL is user-editable, so nothing read from it is trusted. A cast here
 * would fabricate a guarantee: `?order=lol` would be typed `'asc' | 'desc'` and
 * ride straight onto the wire.
 */
const toSortField = (value: string | null): ExpenseSortField =>
  SORT_FIELDS.includes(value as ExpenseSortField)
    ? (value as ExpenseSortField)
    : 'datePaid'

const toSortDirection = (value: string | null): SortDirection =>
  value === 'asc' ? 'asc' : 'desc'

const toPositiveInt = (value: string | null, fallback: number): number => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
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
    page: toPositiveInt(params.get('page'), 1),
    // The tape is continuous rather than paginated, so one page holds a month.
    limit: toPositiveInt(params.get('limit'), 400),
    sortBy: toSortField(params.get('sortBy')),
    sortOrder: toSortDirection(params.get('order')),
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
