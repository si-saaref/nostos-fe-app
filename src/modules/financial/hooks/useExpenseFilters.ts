import { useSearchParams } from 'react-router-dom'
import { useExpenses } from '@/api/queries/expenses'
import type { ExpenseFilters } from '@/types/expense'

const PARAM_MAP: Record<keyof ExpenseFilters, string> = {
  dateFrom: 'dateFrom',
  dateTo: 'dateTo',
  typeId: 'type',
  sourceId: 'source',
  page: 'page',
  limit: 'limit',
  sortBy: 'sortBy',
  sortOrder: 'order',
}

const parseFilters = (params: URLSearchParams): ExpenseFilters => ({
  dateFrom: params.get('dateFrom') ?? undefined,
  dateTo: params.get('dateTo') ?? undefined,
  typeId: params.get('type') ?? undefined,
  sourceId: params.get('source') ?? undefined,
  page: Number(params.get('page') ?? '1'),
  limit: Number(params.get('limit') ?? '25'),
  sortBy: params.get('sortBy') ?? 'datePaid',
  sortOrder: (params.get('order') as 'asc' | 'desc' | null) ?? 'desc',
})

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

  return { filters, updateFilters, clearFilters, ...query }
}
