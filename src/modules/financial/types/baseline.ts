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
