import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useExpenses } from '@/modules/financial/api/expenses'
import { useIncome } from '@/modules/financial/api/income'
import { buildCalendarMonth } from '@/modules/financial/lib/calendarMonth'
import { isoDay, monthRange } from '@/utils/dates'

/** One request per month, the ceiling both list routes accept. */
const PAGE_SIZE = 500

const MONTH_PARAM = /^\d{4}-(0[1-9]|1[0-2])$/
const DAY_PARAM = /^\d{4}-\d{2}-\d{2}$/

const parseMonth = (value: string | null): Date => {
  if (!value || !MONTH_PARAM.test(value)) return firstOfThisMonth()
  const [year, month] = value.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

const firstOfThisMonth = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

const monthParam = (month: Date) =>
  `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`

/**
 * The calendar's whole state: which month, which day, and the two ledgers
 * behind them.
 *
 * Month and day live in the URL and nowhere else, so a shared link, a reload
 * and a stepped month cannot disagree — the same rule the ledgers' filters
 * follow, and the reason a day here is something a person can send to someone.
 *
 * The two queries are deliberately the ordinary list hooks with a month range:
 * the calendar needs no endpoint the ledgers do not already call, and reusing
 * them means one cache entry serves both surfaces when the scopes coincide.
 */
export const useCalendarMonth = (householdId: string) => {
  const [searchParams, setSearchParams] = useSearchParams()

  const month = parseMonth(searchParams.get('month'))
  const { from, to } = monthRange(month)

  const requestedDay = searchParams.get('day')
  const today = isoDay(new Date())
  const holdsToday = today >= from && today <= to

  /**
   * A day from another month is not a day this grid has, so it is dropped
   * rather than clamped. Landing on the 1st of a past month would claim the
   * 1st is the interesting day, which it rarely is — so a past month opens on
   * nothing and waits to be asked.
   */
  const selectedDate =
    requestedDay && DAY_PARAM.test(requestedDay)
      ? requestedDay >= from && requestedDay <= to
        ? requestedDay
        : null
      : holdsToday
        ? today
        : null

  const expenses = useExpenses(householdId, {
    dateFrom: from,
    dateTo: to,
    page: 1,
    limit: PAGE_SIZE,
    sortBy: 'datePaid',
    sortOrder: 'desc',
  })
  const income = useIncome(householdId, {
    dateFrom: from,
    dateTo: to,
    page: 1,
    limit: PAGE_SIZE,
  })

  const calendar = useMemo(
    () => buildCalendarMonth(month, expenses.data, income.data),
    // `month` is a fresh Date every render; its value is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from, expenses.data, income.data],
  )

  const write = (next: { month?: Date; day?: string | null }) => {
    const params = new URLSearchParams(searchParams)
    if (next.month) params.set('month', monthParam(next.month))
    if (next.day === null) params.delete('day')
    else if (next.day) params.set('day', next.day)
    setSearchParams(params)
  }

  const setMonth = (next: Date) =>
    // The day goes with the month: the 14th of March is not a day February
    // has, and carrying it over would open a sheet for a date not on screen.
    write({ month: next, day: null })

  const now = new Date()
  const canStepForward =
    month.getFullYear() < now.getFullYear() ||
    (month.getFullYear() === now.getFullYear() &&
      month.getMonth() < now.getMonth())

  return {
    month,
    selectedDate,
    selectDate: (date: string) => write({ day: date }),
    setMonth,
    stepMonth: (delta: number) =>
      setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1)),
    canStepForward,
    calendar,
    expenseTotals: expenses.data?.totals,
    incomePage: income.data,
    isLoading: expenses.isLoading || income.isLoading,
    isError: expenses.isError || income.isError,
    refetch: () => {
      void expenses.refetch()
      void income.refetch()
    },
  }
}
