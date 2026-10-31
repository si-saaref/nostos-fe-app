import {
  parseLedgerParams,
  serializeLedgerParams,
} from '@/modules/financial/lib/ledgerSearchParams'
import { useSearchParams } from 'react-router-dom'
import { useExpenses } from '@/modules/financial/api/expenses'
import { fromIsoDay, isoDay, monthRange } from '@/utils/dates'
import type { ExpenseFilters } from '@/types/expense'

export const useExpenseFilters = (householdId: string) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const range = monthRange(new Date())
  const defaults: ExpenseFilters = {
    dateFrom: range.from,
    dateTo: range.to,
    page: 1,
    limit: 400,
    sortBy: 'datePaid',
    sortOrder: 'desc',
  }
  const filters = parseLedgerParams(searchParams, defaults)
  const query = useExpenses(householdId, filters)

  const updateFilters = (next: Partial<ExpenseFilters>) => {
    const merged: ExpenseFilters = { ...filters, ...next }
    const params = serializeLedgerParams(merged, defaults)
    if (params.toString() !== searchParams.toString())
      setSearchParams(params, {
        replace:
          Object.keys(next).every(
            (key) => key === 'search' || key === 'page',
          ) && 'search' in next,
      })
  }

  /**
   * The month in view, as a Date on its first day. Derived from `dateFrom`
   * rather than stored: the URL is the only source of truth for scope, so a
   * shared link and a stepped month cannot disagree.
   */
  const month = fromIsoDay(filters.dateFrom ?? isoDay(new Date()))

  /**
   * Scope to a whole calendar month. Page resets with it: page 4 of September
   * is not a place August has.
   */
  const setMonth = (next: Date) => {
    const range = monthRange(next)
    updateFilters({ dateFrom: range.from, dateTo: range.to, page: 1 })
  }

  /**
   * Step whole months. Forward stops at the month containing today — the
   * ledger records what has been paid, and an empty October in September is a
   * view with nothing in it and no way to know that is expected.
   */
  const stepMonth = (delta: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))

  const now = new Date()
  const canStepForward =
    month.getFullYear() < now.getFullYear() ||
    (month.getFullYear() === now.getFullYear() &&
      month.getMonth() < now.getMonth())

  /** True when anything narrows the view beyond the plain month range. */
  const isNarrowed = Boolean(
    filters.typeId ||
    filters.sourceId ||
    filters.paidByUserId ||
    filters.search,
  )

  return {
    filters,
    updateFilters,
    isNarrowed,
    month,
    setMonth,
    stepMonth,
    canStepForward,
    ...query,
  }
}
