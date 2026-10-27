/**
 * Income: every rupiah that entered a payment source, whether it came from
 * outside the household or from another source of its own.
 *
 * One table, two meanings, carried explicitly by `kind` on the wire. Source
 * references must agree with that kind (enforced by the database):
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
  /** The detail behind the name. See `Expense.description`. */
  description?: string | null
  amount: number
  kind: 'EXTERNAL_INCOME' | 'TRANSFER'
  /**
   * Foreign key into the household's `income_types`. The row stores the key,
   * not the word — so an archived type keeps naming the entries that used it,
   * and a renamed one renames its history with it.
   */
  typeId: string | null
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

export interface IncomeFormValues {
  kind: 'EXTERNAL_INCOME' | 'TRANSFER'
  name: string
  description?: string | null
  amount: number
  typeId: string | null
  fromSourceId: string | null
  toSourceId: string
  date: string
}

export type ExternalIncomeInput = Omit<
  IncomeFormValues,
  'kind' | 'typeId' | 'fromSourceId'
> & {
  kind: 'EXTERNAL_INCOME'
  typeId: string
  fromSourceId: null
}
export type TransferInput = Omit<
  IncomeFormValues,
  'kind' | 'typeId' | 'fromSourceId'
> & {
  kind: 'TRANSFER'
  typeId: null
  fromSourceId: string
}
export type CreateIncomeInput = ExternalIncomeInput | TransferInput

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
 * Month and type are the whole scope. Both reach the server, so `meta.summary`
 * is narrowed with the rows and the strip cannot disagree with the statement
 * under it. Search, source and sort stay deferred by the PRD: a filter the API
 * does not accept is a control that looks like it works.
 */
export interface IncomeFilters {
  dateFrom?: string
  dateTo?: string
  typeId?: string
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
  description?: string | null
  amount: string
  kind: 'EXTERNAL_INCOME' | 'TRANSFER'
  type_id: string | null
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
  order: number
  systemKey: IncomeCategorySystemKey | null
}

export type IncomeCategorySystemKey =
  | 'SALARY'
  | 'BONUS'
  | 'BUSINESS'
  | 'FREELANCE'
  | 'GIFT'
  | 'REIMBURSEMENT'
  | 'OTHER'

export interface WireIncomeType {
  id: string
  name: string
  archived_at: string | null
  household_id: string
  order?: number
  system_key?: IncomeCategorySystemKey | null
}

/**
 * What one payment source holds, and what it held when the period opened.
 *
 * Not computable in the browser: a balance is `opening_balance ± income ∓
 * expense` over *all* history, so deriving it from a page of rows would be
 * silently wrong the moment the household outgrows one page. `/positions`
 * answers it (`docs/SURFACE-INCOME.md` §7); on failure the position card says
 * so rather than guessing.
 */
export interface Position {
  sourceId: string
  /** What the source held at the end of the day before the period started. */
  openingBalance: number
  openingBalanceText?: string
  /** What it holds at `as_of`. */
  balance: number
  balanceText?: string
}

export interface WirePosition {
  source_id: string
  opening_balance: string
  balance: string
}

export interface PositionTotals {
  opening: number
  openingText?: string
  balance: number
  balanceText?: string
}

export interface Positions {
  items: Position[]
  totals: PositionTotals
  summary?: PositionSummary
}

export interface PositionSummary {
  totalBalance: number
  totalBalanceText?: string
  currency: string
  asOf: string
}

export interface WirePositionSummary {
  total_balance: string
  currency: string
  as_of: string
}
