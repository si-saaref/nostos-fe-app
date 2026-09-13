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
  /** @deprecated Superseded by `summary`. See `notes/FE-App/API-CHANGES-2026-09-10.md`. */
  totals?: WireTotals
  summary?: WireSummary
}

/**
 * The list route's whole answer about the filtered set, and the block that
 * retires `meta.totals`.
 *
 * `totals` could only ever describe the current filtered page-set, so every
 * other figure the ledger prints — last month's spend, the biggest category,
 * what an item usually costs — had to be bought with another request. Three
 * `/expenses` on one page load, two `/income`, each one an aggregate the
 * server could compute in the same query it was already running.
 *
 * So `summary` carries them. Every block below `current` is optional: a
 * deployment that sends only `current` is still correct, and the client falls
 * back to the extra requests it makes today. Absent is never zero — a zero
 * here is a claim about the household's money.
 *
 * Requested in `notes/FE-App/API-CHANGES-2026-09-10.md` §2.
 */
export interface WireSummary {
  current: WireTotals
  /** The same filters over the preceding period of equal length. */
  previous?: WireTotals
  /**
   * Ranked contributors to `current.sum`, biggest first, capped at 5 and
   * ordered `sum DESC, count DESC, id ASC` so two tied types cannot swap
   * places between requests. Expenses only — income has no `paid_by_user_id`,
   * and an empty filtered set yields `by_type: []` rather than an absent
   * block, because "nothing matched" is an answer.
   */
  breakdown?: {
    by_type?: WireSummarySlice[]
    by_member?: WireSummarySlice[]
  }
}

export interface WireSummarySlice {
  id: string
  sum: number
  count: number
}

export interface WirePagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

/**
 * `moved`, `external_count` and `transfer_count` are income-only and therefore
 * optional: expenses answer three keys, income six, and one shape holds both.
 * Absent is not zero — a zero here would be a claim about the household's
 * money that the server never made.
 */
export interface WireTotals {
  sum: number
  count: number
  average: number
  moved?: number
  external_count?: number
  transfer_count?: number
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
  /**
   * The filtered set's aggregates. Sourced from `meta.summary.current` when
   * the deployment sends one and from the legacy `meta.totals` otherwise, so
   * everything already reading `totals` keeps working through the migration.
   */
  totals?: Totals
  /**
   * Present only on a deployment that ships `meta.summary`. Its presence is
   * the feature flag: each block it carries is one request the page does not
   * have to make, and each block it omits is one the page still makes.
   */
  summary?: Summary
}

/** Domain mirror of `WireSummary`. See it for what each block is for. */
export interface Summary {
  current: Totals
  previous?: Totals
  breakdown?: {
    byType?: SummarySlice[]
    byMember?: SummarySlice[]
  }
}

export interface SummarySlice {
  id: string
  sum: number
  count: number
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
  /**
   * Income only, and spelled as they arrive on the wire: `unwrapPage` spreads
   * `meta.totals` rather than mapping it key by key, so keeping the two shapes
   * identical is what makes that spread honest. A mapper here that silently
   * dropped a key is the failure this contract is arranged to avoid.
   */
  moved?: number
  external_count?: number
  transfer_count?: number
}
