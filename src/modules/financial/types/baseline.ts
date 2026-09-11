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

/**
 * One past purchase, as the lifted plate's chart needs it. Narrower than
 * `Expense` on purpose: the points can come from the rows the tape already
 * holds *or* from `meta.summary.baselines[].recent`, and the server has no
 * reason to send a whole expense to draw a bar.
 */
export interface RecentPoint {
  id: string
  value: number
  datePaid: string
}
