/**
 * Income: every rupiah that entered a payment source, whether it came from
 * outside the household or from another source of its own.
 *
 * One table, two meanings, decided by `fromSourceId` (income PRD §5):
 *
 *   from: null,  to: BNI   → external inflow. The household holds more.
 *   from: BNI,   to: Cash  → transfer. The household holds exactly as much.
 *
 * That distinction is not cosmetic. `totals.sum` is `sum(to) − sum(from)`, so a
 * transfer cancels itself out of every aggregate — which is correct, and which
 * is why a transfer must never be rendered with a `+` in front of it.
 */
export interface Income {
  id: string
  name: string
  amount: number
  /**
   * The household's own word for this kind of money — a *name*, not a foreign
   * key. The column is `VARCHAR(100)` (PRD §5) and `income_types` is a
   * separate curated list the picker reads; the row stores what was chosen.
   * Modelled as the string it is, so nothing here implies a join the API
   * does not have.
   */
  type: string
  /** `null` means the money came from outside the household. */
  fromSourceId: string | null
  toSourceId: string
  /** Calendar day, `YYYY-MM-DD`. Not a timestamp: the tape groups by string
   *  equality and a timestamp would shard one day across two timezones. */
  date: string
  householdId: string
  /** Audit stamps, optional for the same reason as `Expense`'s. */
  createdByUserId?: string
  updatedByAdminId?: string | null
  createdAt?: string
  updatedAt?: string | null
}

export interface CreateIncomeInput {
  name: string
  amount: number
  type: string
  fromSourceId: string | null
  toSourceId: string
  date: string
}

/**
 * What an admin may change (AC3.3 — all six fields).
 *
 * The tri-state PATCH semantics fall out of the types rather than needing a
 * convention: `fromSourceId` is `string | null` on the input, so `Partial`
 * widens it to `string | null | undefined` — absent leaves it alone, a value
 * writes it, and `null` clears it back to an external inflow. Every other
 * field is non-nullable, so `null` there is a 400.
 */
export type UpdateIncomeInput = Partial<CreateIncomeInput>

/**
 * Month is the only scope. Search, filter and sort are deferred by the PRD, so
 * there is deliberately nothing here to narrow by type, source or person —
 * a filter the API does not accept is a control that looks like it works.
 */
export interface IncomeFilters {
  dateFrom?: string
  dateTo?: string
  page: number
  limit: number
}

/**
 * `GET|POST .../income` on the wire, snake_case as sent. Written out rather
 * than derived, for the same reason as `WireExpense`: this shape's job is to be
 * diffable line-by-line against the API document.
 */
export interface WireIncome {
  id: string
  name: string
  amount: number
  type: string
  from_source_id: string | null
  to_source_id: string
  date: string
  household_id: string
  created_by_user_id?: string
  updated_by_admin_id?: string | null
  created_at?: string
  updated_at?: string | null
}

/** Soft-deleted rows never reach the client; modelled only so the mock can hold one. */
export type StoredIncome = Income & { deletedAt: string | null }

/**
 * A household's curated income types. Simpler than `Category` — no colour and
 * no ordering (PRD §5), because income identity travels on the source rim and
 * a type is only ever a word.
 */
export interface IncomeType {
  id: string
  name: string
  archivedAt: string | null
  householdId: string
}

export interface WireIncomeType {
  id: string
  name: string
  archived_at: string | null
  household_id: string
}

/**
 * What one payment source holds, and what it held when the period opened.
 *
 * Not computable in the browser: a balance is `opening_balance ± income ∓
 * expense` over *all* history, so deriving it from a page of rows would be
 * silently wrong the moment the household outgrows one page. This is the shape
 * of the endpoint that owes us the answer (`docs/SURFACE-INCOME.md` §7); until
 * it exists the position card says so rather than guessing.
 */
export interface Position {
  sourceId: string
  /** What the source held at the end of the day before the period started. */
  openingBalance: number
  /** What it holds at `as_of`. */
  balance: number
}

export interface WirePosition {
  source_id: string
  opening_balance: number
  balance: number
}

export interface PositionTotals {
  opening: number
  balance: number
}

export interface Positions {
  items: Position[]
  totals: PositionTotals
}
