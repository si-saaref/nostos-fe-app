/**
 * Every v1 response is wrapped. `data` is uniformly the resource — never a
 * wrapper around it — and the list routes hoist their counts into `meta`
 * (BACKEND.md D15), so one unwrap works for every endpoint.
 */
export interface ApiEnvelope<T> {
  success: boolean
  data: T
  message?: string
  meta?: ApiMeta
}

/**
 * The wire's `meta` block, snake_case as the API sends it.
 *
 * Kept separate from the domain `Paginated` below rather than folded into it:
 * `total_pages` and `totalPages` differing by one underscore is exactly the
 * class of mismatch that reads as a working control doing nothing, so the two
 * shapes are named differently and converted in one place (`unwrapPage`).
 */
export interface ApiMeta {
  pagination?: WirePagination
  totals?: WireTotals
}

export interface WirePagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

export interface WireTotals {
  sum: number
  count: number
  average: number
}

/**
 * The API's error envelope (auth PRD v3.1 §0). `message` stays optional and
 * flat for the handful of endpoints still answering the older shape.
 *
 * `details` is deliberately untyped-per-case: a 400 carries an array of
 * `{ field, code, message }`, while `HOUSEHOLD_DELETION_PENDING` carries an
 * object with `deletion_scheduled_for`. Callers narrow at the point of use.
 */
export interface ApiErrorBody {
  success?: boolean
  status_code?: number
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
  message?: string
  statusCode?: number
  details?: unknown
}

/** One failed constraint from a 400. `code` is the validator name, upper-snaked. */
export interface ApiFieldError {
  field: string
  code: string
  message: string
}

/**
 * The domain page. camelCase, because everything above the api module is —
 * `totalPages` rather than the wire's `total_pages`, and `limit` is carried
 * even though nothing reads it back yet, so a page can be re-requested from
 * what it already knows about itself.
 */
export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface Paginated<T> {
  items: T[]
  pagination: Pagination
  totals?: Totals
}

/**
 * Filter-scoped aggregates returned alongside every list page (BE PRD §3.1).
 * These describe the whole filtered set, not the current page — which is why
 * anything rendered from them must state the scope it is counting, and why
 * they cannot be recomputed client-side from `items`.
 */
export interface Totals {
  sum: number
  count: number
  average: number
}
