/**
 * Every v1 response is wrapped. `data` is uniformly the resource — the list
 * routes hoist their counts into `meta` rather than nesting them here
 * (BACKEND.md D15), so one unwrap works for every endpoint.
 */
export interface ApiEnvelope<T> {
  success: boolean
  data: T
  message?: string
}

/**
 * The API's error envelope (auth PRD v3.1 §0). `message` stays optional and
 * flat for the handful of endpoints still answering the older shape.
 */
export interface ApiErrorBody {
  success?: boolean
  status_code?: number
  error?: {
    code?: string
    message?: string
  }
  message?: string
  statusCode?: number
}

export interface Pagination {
  total: number
  page: number
  pages: number
}

export interface Paginated<T> {
  items: T[]
  pagination: Pagination
  totals?: Totals
}

/**
 * Filter-scoped aggregates returned alongside every list page (BE PRD §3.1).
 * These describe the whole filtered set, not the current page — which is why
 * anything rendered from them must state the scope it is counting.
 */
export interface Totals {
  sum: number
  count: number
  average: number
}
