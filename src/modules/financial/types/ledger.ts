import type { RimIndex } from '@/theme/rims'
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

/**
 * One active narrowing, stated on the count strip and dismissible there.
 *
 * The strip has to print every filter it is counting under — a filter-scoped
 * total with an unstated filter misreports silently — so the place that states
 * the scope is also the place that removes it. That is what retired the
 * separate "Clear filters" button.
 */
export interface ScopeChip {
  /** Which filter key this chip owns, so removal is unambiguous. */
  id: 'typeId' | 'sourceId' | 'paidByUserId' | 'search'
  label: string
  /** Category rim, when the chip stands for a category. */
  rim?: RimIndex
}

/**
 * The single largest contributor to the filtered spend.
 *
 * Derived from the loaded rows, never from `totals` — the API has no grouped
 * aggregate endpoint — so it is only honest while the page holds the whole
 * filtered set. `TopSlice` is therefore built by the page, which is the only
 * caller that can compare `items.length` against `totals.count`.
 */
export interface TopSlice {
  /** Category normally; member once a single category is already filtered. */
  kind: 'category' | 'member'
  name: string
  amount: number
  pct: number
  runnerUp?: { name: string; pct: number }
}
