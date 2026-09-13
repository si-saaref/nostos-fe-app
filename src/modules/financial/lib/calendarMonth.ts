import { isoDay, monthRange } from '@/utils/dates'
import { sumMoney } from '@/utils/money'
import type { Paginated } from '@/types/api'
import type { Expense } from '@/types/expense'
import type { Income } from '@/types/income'

/**
 * One day of the grid. Every day of the month gets one, spent or not — a month
 * drawn only where money moved hides its gaps, and the gaps are half of what
 * the shape of a month tells you.
 */
export interface CalendarDay {
  date: string
  /** What left the household that day. */
  spent: number
  /** What arrived from outside it. Raises what it holds. */
  inflow: number
  /** What only changed pockets. Never added to `inflow`. */
  moved: number
  expenses: Expense[]
  income: Income[]
  count: number
}

export interface CalendarMonth {
  days: CalendarDay[]
  /**
   * The busiest day of each stream, which is what its own marks are drawn
   * against. Deliberately three numbers and not one: see `markFraction`.
   */
  maxSpent: number
  maxInflow: number
  maxMoved: number
  /** The heaviest spending day, for the strip. `null` when nothing was spent. */
  busiest: CalendarDay | null
  /** Rows in the filtered set, from `pagination.total` — not rows on hand. */
  entryCount: number
  /**
   * Do the two pages hold every row of their sets? Only then may the grid be
   * drawn: a month missing days is a false statement about the household's
   * month, in the same way a partial total is.
   */
  isComplete: boolean
}

/** Blank cells before the 1st, on a Monday-start week. */
export const leadingBlanks = (month: Date): number => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  return (first.getDay() + 6) % 7
}

/**
 * The floor exists because a mark is a claim that something happened. A
 * Rp 5.000 parking fee in a month holding a Rp 5.000.000 day scales to 0.1%,
 * which renders as nothing at all — and "nothing recorded" is a different fact
 * from "a little". Days with a genuine zero return zero and draw no mark.
 */
const MARK_FLOOR = 0.08

export const markFraction = (value: number, max: number): number => {
  if (value <= 0 || max <= 0) return 0
  return Math.max(MARK_FLOOR, Math.min(1, value / max))
}

const emptyDay = (date: string): CalendarDay => ({
  date,
  spent: 0,
  inflow: 0,
  moved: 0,
  expenses: [],
  income: [],
  count: 0,
})

/** Every day of the month, in order, as ISO days. */
const eachDayOf = (month: Date): string[] => {
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  return Array.from({ length: count }, (_, index) =>
    isoDay(new Date(month.getFullYear(), month.getMonth(), index + 1)),
  )
}

/**
 * The month's rows, arranged as a grid.
 *
 * Rows outside the month are dropped rather than clamped onto an edge day: the
 * request is already scoped to the month, so a stray row is a response that
 * disagrees with its own filters, and putting it on the 1st would invent a day.
 */
export const buildCalendarMonth = (
  month: Date,
  expenses: Paginated<Expense> | undefined,
  income: Paginated<Income> | undefined,
): CalendarMonth => {
  const { from, to } = monthRange(month)
  const byDate = new Map(eachDayOf(month).map((date) => [date, emptyDay(date)]))
  const within = (date: string) => date >= from && date <= to

  expenses?.items.forEach((row) => {
    if (!within(row.datePaid)) return
    byDate.get(row.datePaid)?.expenses.push(row)
  })
  income?.items.forEach((row) => {
    if (!within(row.date)) return
    byDate.get(row.date)?.income.push(row)
  })

  const days = [...byDate.values()].map((day) => {
    const moving = day.income.filter((row) => row.fromSourceId !== null)
    const arriving = day.income.filter((row) => row.fromSourceId === null)
    return {
      ...day,
      spent: sumMoney(day.expenses.map((row) => row.value)),
      inflow: sumMoney(arriving.map((row) => row.amount)),
      moved: sumMoney(moving.map((row) => row.amount)),
      count: day.expenses.length + day.income.length,
    }
  })

  const busiest = days.reduce<CalendarDay | null>(
    (heaviest, day) =>
      day.spent > 0 && (!heaviest || day.spent > heaviest.spent)
        ? day
        : heaviest,
    null,
  )

  const holdsEverySet =
    expenses !== undefined &&
    income !== undefined &&
    expenses.items.length >= expenses.pagination.total &&
    income.items.length >= income.pagination.total

  return {
    days,
    maxSpent: Math.max(0, ...days.map((day) => day.spent)),
    maxInflow: Math.max(0, ...days.map((day) => day.inflow)),
    maxMoved: Math.max(0, ...days.map((day) => day.moved)),
    busiest,
    entryCount:
      (expenses?.pagination.total ?? 0) + (income?.pagination.total ?? 0),
    isComplete: holdsEverySet,
  }
}
