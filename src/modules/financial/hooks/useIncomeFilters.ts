import { useSearchParams } from 'react-router-dom'
import { useIncome } from '@/modules/financial/api/income'
import {
  fromIsoDay,
  isoDay,
  monthRange,
  previousMonthRange,
} from '@/utils/dates'
import type { IncomeFilters } from '@/types/income'

const PARAM_MAP: Record<keyof IncomeFilters, string> = {
  dateFrom: 'dateFrom',
  dateTo: 'dateTo',
  typeId: 'type',
  page: 'page',
  limit: 'limit',
}

const toPositiveInt = (value: string | null, fallback: number): number => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * The month lives in the URL and nowhere else, so a shared link, a reload and
 * a stepped month cannot disagree. It is written into the filters rather than
 * left implicit, because every figure on the page is scoped by it and a total
 * whose range is unstated misreports silently.
 *
 * `typeId` lives here but never reaches the wire: the route takes no
 * `type_id`, so the page narrows the rows it already holds. It is in the URL
 * anyway, because a narrowed view has to be shareable and has to survive a
 * reload like every other scope in this product. Search, source and sort stay
 * deferred by the PRD.
 */
const parseFilters = (params: URLSearchParams): IncomeFilters => {
  const thisMonth = monthRange(new Date())
  return {
    dateFrom: params.get('dateFrom') ?? thisMonth.from,
    dateTo: params.get('dateTo') ?? thisMonth.to,
    typeId: params.get('type') ?? undefined,
    page: toPositiveInt(params.get('page'), 1),
    // One request per month. The statement is continuous, and the strip's
    // derived figures only render when the page holds every row of the month.
    limit: toPositiveInt(params.get('limit'), 400),
  }
}

export const useIncomeFilters = (householdId: string) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = parseFilters(searchParams)
  // `typeId` is deliberately kept out of the request and therefore out of the
  // query key: it narrows client-side, so including it would fork the cache
  // and refetch the identical month on every change of the picker.
  const query = useIncome(householdId, {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    page: filters.page,
    limit: filters.limit,
  })

  const updateFilters = (next: Partial<IncomeFilters>) => {
    const merged: IncomeFilters = { ...filters, ...next }
    const params = new URLSearchParams()
    ;(Object.keys(PARAM_MAP) as (keyof IncomeFilters)[]).forEach((key) => {
      const value = merged[key]
      if (value !== undefined && value !== '' && value !== null) {
        params.set(PARAM_MAP[key], String(value))
      }
    })
    setSearchParams(params)
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

  /**
   * The day every cumulative figure is true as of: today while the month in
   * view is the current one, its last day once it is in the past.
   *
   * Without this, stepping back to March would ask for balances "as of today"
   * and print a position that has nothing to do with the flows beside it.
   */
  const asOf = canStepForward ? (filters.dateTo ?? isoDay(now)) : isoDay(now)

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
