import {
  parseLedgerParams,
  serializeLedgerParams,
} from '@/modules/financial/lib/ledgerSearchParams'
import { householdDay } from '@/modules/financial/lib/householdDay'
import { useHouseholdPrefs } from '@/modules/settings/api/prefs'
import { useSearchParams } from 'react-router-dom'
import { useIncome } from '@/modules/financial/api/income'
import {
  fromIsoDay,
  isoDay,
  monthRange,
  previousMonthRange,
} from '@/utils/dates'
import type { IncomeFilters } from '@/types/income'

export const useIncomeFilters = (householdId: string) => {
  const { data: prefs } = useHouseholdPrefs(householdId)
  const [searchParams, setSearchParams] = useSearchParams()
  const range = monthRange(new Date())
  const defaults: IncomeFilters = {
    dateFrom: range.from,
    dateTo: range.to,
    page: 1,
    limit: 400,
  }
  const filters = parseLedgerParams(searchParams, defaults)
  const query = useIncome(householdId, filters)

  const updateFilters = (next: Partial<IncomeFilters>) => {
    const merged: IncomeFilters = { ...filters, ...next }
    const params = serializeLedgerParams(merged, defaults)
    if (params.toString() !== searchParams.toString())
      setSearchParams(params, {
        replace:
          Object.keys(next).every(
            (key) => key === 'search' || key === 'page',
          ) && 'search' in next,
      })
  }

  /** The month in view, as a Date on its first day. Derived, never stored. */
  const month = fromIsoDay(filters.dateFrom ?? isoDay(new Date()))

  const setMonth = (next: Date) => {
    const range = monthRange(next)
    // Page resets with the month: page 4 of September is not a place August has.
    updateFilters({ dateFrom: range.from, dateTo: range.to, page: 1 })
  }

  const stepMonth = (delta: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))

  const now = new Date()
  const canStepForward =
    month.getFullYear() < now.getFullYear() ||
    (month.getFullYear() === now.getFullYear() &&
      month.getMonth() < now.getMonth())

  // Month opening remains scoped by `from`; current balance always answers
  // the same household-today question as the shared header.
  const asOf = householdDay(now, prefs?.timezone ?? 'Asia/Jakarta')

  return {
    filters,
    updateFilters,
    month,
    setMonth,
    stepMonth,
    canStepForward,
    previousMonth: previousMonthRange(month),
    asOf,
    ...query,
  }
}
