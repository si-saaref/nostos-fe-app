import { fromIsoDay, monthRange } from '@/utils/dates'
import type { ExpenseFilters } from '@/types/expense'
import type { IncomeFilters } from '@/types/income'
type Filters = ExpenseFilters | IncomeFilters
const positive = (value: string | null, fallback: number) =>
  Number.isInteger(Number(value)) && Number(value) > 0
    ? Number(value)
    : fallback
const keys = {
  typeId: 'type',
  sourceId: 'source',
  paidByUserId: 'paidBy',
  search: 'q',
} as const

export const parseLedgerParams = <T extends Filters>(
  params: URLSearchParams,
  defaults: T,
): T => {
  const selected = params.get('month')
  const validMonth = selected && /^\d{4}-(0[1-9]|1[0-2])$/.test(selected)
  const range = validMonth
    ? monthRange(fromIsoDay(`${selected}-01`))
    : { from: defaults.dateFrom, to: defaults.dateTo }
  const result = {
    ...defaults,
    dateFrom: params.get('dateFrom') ?? range.from,
    dateTo: params.get('dateTo') ?? range.to,
    page: positive(params.get('page'), defaults.page),
    limit: positive(params.get('limit'), defaults.limit),
  }
  for (const [key, param] of Object.entries(keys))
    Object.assign(result, { [key]: params.get(param) || undefined })
  if ('sortBy' in defaults) {
    const sort = params.get('sortBy')
    Object.assign(result, {
      sortBy:
        sort && ['datePaid', 'value', 'name'].includes(sort)
          ? sort
          : defaults.sortBy,
      sortOrder: params.get('order') === 'asc' ? 'asc' : defaults.sortOrder,
    })
  }
  return result
}

export const serializeLedgerParams = <T extends Filters>(
  filters: T,
  defaults: T,
): URLSearchParams => {
  const params = new URLSearchParams()
  const from = filters.dateFrom
  const to = filters.dateTo
  const range = from ? monthRange(fromIsoDay(from)) : undefined
  if (from !== defaults.dateFrom || to !== defaults.dateTo) {
    if (from && range?.from === from && range.to === to)
      params.set('month', from.slice(0, 7))
    else {
      if (from) params.set('dateFrom', from)
      if (to) params.set('dateTo', to)
    }
  }
  for (const [key, param] of Object.entries(keys)) {
    const value = (filters as unknown as Record<string, unknown>)[key]
    if (value) params.set(param, String(value))
  }
  if (filters.page !== defaults.page) params.set('page', String(filters.page))
  if (filters.limit !== defaults.limit)
    params.set('limit', String(filters.limit))
  if ('sortBy' in filters && 'sortBy' in defaults) {
    if (filters.sortBy !== defaults.sortBy) params.set('sortBy', filters.sortBy)
    if (filters.sortOrder !== defaults.sortOrder)
      params.set('order', filters.sortOrder)
  }
  return params
}
