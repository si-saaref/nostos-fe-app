import { useCallback, useMemo } from 'react'
import { useExpenses } from '@/modules/financial/api/expenses'
import { isoDay, shiftDays } from '@/utils/dates'
import type { Expense } from '@/types/expense'
import type { Baseline, Verdict } from '@/modules/financial/types/baseline'

/**
 * "What's normal?" — the household's own history, per recurring item.
 *
 * Keyed on the expense *name*, not the category. A category is far too coarse
 * to judge with: "Transport" holds both a Rp24k ojek and a Rp102k tank of
 * petrol, so a category median flags every expensive-but-ordinary entry and
 * the ledger cries wolf. An item the household has never bought before simply
 * gets no verdict — we have nothing to compare it to, and saying nothing is
 * the honest answer.
 *
 * The API has no aggregate endpoint, so this is computed on the client from a
 * single wide request over recent history. That is affordable at household
 * scale (a few hundred rows) and needs no backend change; if grouped
 * aggregates ever ship, only this hook moves.
 */
const BASELINE_WINDOW_DAYS = 120

/** Below this many entries a category has no opinion worth voicing. */
const MIN_SAMPLE_SIZE = 5

/** A never-seen item must clear this multiple of its category's p75 to speak. */
const GROSS_OUTLIER = 2.5

/** Ratios inside this band are ordinary and stay silent. */
const QUIET_LOW = 0.75
const QUIET_HIGH = 1.25

/** How many past purchases the lifted plate charts. */
const RECENT_TAKE = 4

/** One shared empty result, so "no history" is referentially stable too. */
const NO_ROWS: Expense[] = []

/** Same purchase, loosely spelled — "Token listrik" and "token  Listrik". */
const itemKey = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ')

const quantile = (sorted: number[], q: number): number => {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const next = sorted[base + 1]
  return next === undefined
    ? sorted[base]
    : sorted[base] + rest * (next - sorted[base])
}

const baselineFrom = (key: string, values: number[]): Baseline | undefined => {
  if (values.length < MIN_SAMPLE_SIZE) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  return {
    key,
    count: sorted.length,
    median: quantile(sorted, 0.5),
    low: quantile(sorted, 0.25),
    high: quantile(sorted, 0.75),
    min: sorted[0],
  }
}

const groupBy = <T>(rows: T[], keyOf: (row: T) => string): Map<string, T[]> => {
  const groups = new Map<string, T[]>()
  rows.forEach((row) => {
    const key = keyOf(row)
    const bucket = groups.get(key)
    if (bucket) bucket.push(row)
    else groups.set(key, [row])
  })
  return groups
}

export const useItemBaselines = (householdId: string) => {
  const today = new Date()
  const query = useExpenses(householdId, {
    dateFrom: isoDay(shiftDays(today, -BASELINE_WINDOW_DAYS)),
    dateTo: isoDay(today),
    page: 1,
    limit: 1000,
    sortBy: 'datePaid',
    sortOrder: 'desc',
  })

  const items = useMemo(() => query.data?.items ?? [], [query.data])

  /**
   * Indexed once per fetch rather than scanned per row. The tape calls
   * `recentFor` and `judge` for every entry it renders, so a linear scan here
   * is quadratic on screen.
   */
  const byItem = useMemo(
    () => groupBy(items, (expense) => itemKey(expense.name)),
    [items],
  )

  const categoryBaselines = useMemo(() => {
    const result = new Map<string, Baseline>()
    groupBy(items, (expense) => expense.typeId).forEach((rows, typeId) => {
      const baseline = baselineFrom(
        typeId,
        rows.map((row) => row.value),
      )
      if (baseline) result.set(typeId, baseline)
    })
    return result
  }, [items])

  const baselines = useMemo(() => {
    const result = new Map<string, Baseline>()
    byItem.forEach((rows, key) => {
      const baseline = baselineFrom(
        key,
        rows.map((row) => row.value),
      )
      if (baseline) result.set(key, baseline)
    })
    return result
  }, [byItem])

  /**
   * The instrument's whole discipline lives here: a row is silent unless the
   * household's own history says otherwise, and it never speaks without a
   * sample big enough to mean something.
   */
  const judge = useCallback(
    (expense: Expense): Verdict => {
      const baseline = baselines.get(itemKey(expense.name))

      // No history for this exact item. Stay quiet unless it dwarfs everything
      // the household has ever spent in its category — then the honest claim is
      // about the category, not about "usual", and it is worded that way.
      if (!baseline || baseline.median === 0) {
        const category = categoryBaselines.get(expense.typeId)
        if (category && expense.value > category.high * GROSS_OUTLIER) {
          return {
            kind: 'bigForCategory',
            factor: expense.value / category.median,
            baseline: category,
          }
        }
        return { kind: 'unknown' }
      }
      const factor = expense.value / baseline.median
      if (expense.value > baseline.high && factor >= QUIET_HIGH) {
        return { kind: 'high', factor, baseline }
      }
      if (
        expense.value <= baseline.min &&
        baseline.count >= MIN_SAMPLE_SIZE * 2
      ) {
        return { kind: 'cheapest', baseline }
      }
      if (expense.value < baseline.low && factor <= QUIET_LOW) {
        return { kind: 'low', factor, baseline }
      }
      return { kind: 'quiet' }
    },
    [baselines, categoryBaselines],
  )

  /**
   * Recent purchases of the same item, oldest first — the lifted plate's chart.
   * Built once per fetch so each row gets the *same* array on every render:
   * a fresh array per call would defeat the tape's memoisation.
   */
  const recentByItem = useMemo(() => {
    const result = new Map<string, Expense[]>()
    byItem.forEach((rows, key) => {
      result.set(key, rows.slice(0, RECENT_TAKE).reverse())
    })
    return result
  }, [byItem])

  const recentFor = useCallback(
    (name: string): Expense[] => recentByItem.get(itemKey(name)) ?? NO_ROWS,
    [recentByItem],
  )

  const baselineFor = useCallback(
    (name: string): Baseline | undefined => baselines.get(itemKey(name)),
    [baselines],
  )

  return { baselineFor, judge, recentFor, isLoading: query.isLoading }
}
