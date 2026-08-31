import type { Expense } from '@/types/expense'

/**
 * The tape's view model. Built by the page and handed down, so it lives above
 * both the component that renders shelves and the one that renders the rail.
 */
export interface DayGroup {
  date: string
  total: number
  expenses: Expense[]
}

/** One day's bar on the month rail. */
export interface DayTotal {
  date: string
  total: number
  count: number
}
