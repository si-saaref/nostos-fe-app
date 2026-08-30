import { useMemo } from 'react'
import { useExpenses } from '@/api/queries/expenses'
import { isoDay, shiftDays } from '@/utils/dates'
import type { Expense } from '@/types/expense'

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
export const BASELINE_WINDOW_DAYS = 120

/** Below this many entries a category has no opinion worth voicing. */
export const MIN_SAMPLE = 5

/** A never-seen item must clear this multiple of its category's p75 to speak. */
const GROSS_OUTLIER = 2.5

/** Ratios inside this band are ordinary and stay silent. */
const QUIET_LOW = 0.75
const QUIET_HIGH = 1.25

export interface Baseline {
  /** Normalised expense name this baseline describes. */
  key: string
  count: number
  median: number
  /** Interquartile range — the household's usual spread for this category. */
  low: number
  high: number
  min: number
}

export type Verdict =
  | { kind: 'quiet' }
  | { kind: 'unknown' }
  /** No history for this item, but far beyond what the category ever costs. */
  | { kind: 'bigForCategory'; factor: number; baseline: Baseline }
  | { kind: 'high'; factor: number; baseline: Baseline }
  | { kind: 'low'; factor: number; baseline: Baseline }
  | { kind: 'cheapest'; baseline: Baseline }

/** Same purchase, loosely spelled — "Token listrik" and "token  Listrik". */
export const itemKey = (name: string): string =>
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

  const buckets = useMemo(() => {
    const byType = new Map<string, number[]>()
    query.data?.items.forEach((expense) => {
      const bucket = byType.get(expense.typeId)
      if (bucket) bucket.push(expense.value)
      else byType.set(expense.typeId, [expense.value])
    })
    return { byType }
  }, [query.data])

  const categoryBaselines = useMemo(() => {
    const result = new Map<string, Baseline>()
    buckets.byType.forEach((values, typeId) => {
      if (values.length < MIN_SAMPLE) return
      const sorted = [...values].sort((a, b) => a - b)
      result.set(typeId, {
        key: typeId,
        count: sorted.length,
        median: quantile(sorted, 0.5),
        low: quantile(sorted, 0.25),
        high: quantile(sorted, 0.75),
        min: sorted[0],
      })
    })
    return result
  }, [buckets])

  const baselines = useMemo(() => {
    const byItem = new Map<string, number[]>()
    query.data?.items.forEach((expense) => {
      const key = itemKey(expense.name)
      const bucket = byItem.get(key)
      if (bucket) bucket.push(expense.value)
      else byItem.set(key, [expense.value])
    })

    const result = new Map<string, Baseline>()
    byItem.forEach((values, key) => {
      if (values.length < MIN_SAMPLE) return
      const sorted = [...values].sort((a, b) => a - b)
      result.set(key, {
        key,
        count: sorted.length,
        median: quantile(sorted, 0.5),
        low: quantile(sorted, 0.25),
        high: quantile(sorted, 0.75),
        min: sorted[0],
      })
    })
    return result
  }, [query.data])

  /**
   * The instrument's whole discipline lives here: a row is silent unless the
   * household's own history says otherwise, and it never speaks without a
   * sample big enough to mean something.
   */
  const judge = (expense: Expense): Verdict => {
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
    if (expense.value <= baseline.min && baseline.count >= MIN_SAMPLE * 2) {
      return { kind: 'cheapest', baseline }
    }
    if (expense.value < baseline.low && factor <= QUIET_LOW) {
      return { kind: 'low', factor, baseline }
    }
    return { kind: 'quiet' }
  }

  /** Recent purchases of the same item, oldest first — the lifted plate's chart. */
  const recentFor = (name: string, take = 4): Expense[] =>
    (query.data?.items ?? [])
      .filter((expense) => itemKey(expense.name) === itemKey(name))
      .slice(0, take)
      .reverse()

  const baselineFor = (name: string): Baseline | undefined =>
    baselines.get(itemKey(name))

  return {
    baselines,
    baselineFor,
    judge,
    recentFor,
    isLoading: query.isLoading,
  }
}
