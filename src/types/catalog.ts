/**
 * Reference data the household configures in Settings and the ledger reads on
 * every row. Shared rather than module-owned: Settings writes these, Financial
 * points at them, and one model per endpoint is what keeps the two in step.
 */

/**
 * Categories are flat and household-configured. `archivedAt` rather than a
 * delete: past expenses keep pointing at the category that was true when they
 * were recorded, and the ledger renders it with an archived marker.
 */
export interface Category {
  id: string
  name: string
  /** Position in the household's list — also what determines its rim colour. */
  order: number
  archivedAt: string | null
  householdId: string
  systemKey: ExpenseCategorySystemKey | null
}

export type ExpenseCategorySystemKey =
  | 'FOOD_DRINK'
  | 'GROCERIES'
  | 'TRANSPORTATION'
  | 'BILLS'
  | 'HOUSING'
  | 'SHOPPING'
  | 'HEALTH'
  | 'ENTERTAINMENT'
  | 'EDUCATION'
  | 'GIFTS_DONATIONS'
  | 'SUBSCRIPTIONS'
  | 'OTHER'

export type AccountSystemKey = 'DEFAULT_CASH' | 'DEFAULT_BANK'

/**
 * What the API sends. Uppercase, matching `role` and `household_status` —
 * BE `API-SPEC-DEVIATIONS.md` #2 settles the open decision in §6 of the FE
 * spec, which had assumed lowercase.
 */
export type WireAccountKind = 'CASH' | 'BANK' | 'EWALLET'

/**
 * What the app uses. Lowercase, like every other domain enum here, and what
 * the Settings radio group binds to — which is why this is a mapping and not
 * a rename.
 */
export type AccountKind = 'cash' | 'bank' | 'ewallet'

/**
 * Accounts are where money actually sits, shared by every module rather than
 * owned by Expense. Opening balance plus an as-of date is what eventually makes
 * a real balance derivable: opening + income − expense, per account.
 */
export interface Account {
  calculationStartCanSet?: boolean
  calculationStartSetAt?: string | null
  id: string
  name: string
  kind: AccountKind
  openingBalance: number
  /** The date the opening balance was true. */
  asOf: string
  order: number
  archivedAt: string | null
  householdId: string
  systemKey: AccountSystemKey | null
  isProtected: boolean
}

export interface BalanceAdjustment {
  id: string
  householdId: string
  sourceId: string
  createdByUserId: string
  delta: number
  date: string
  reason: string
  createdAt: string
}

export interface WireBalanceAdjustment {
  id: string
  household_id: string
  source_id: string
  created_by_user_id: string
  delta: string
  date: string
  reason: string
  created_at: string
}

/**
 * `/expense-types` and `/payment-sources` on the wire, snake_case as sent.
 * Spelled out rather than derived, for the same reason as `WireExpense`: this
 * shape's job is to be diffable against the API document.
 */
export interface WireCategory {
  id: string
  name: string
  order: number
  archived_at: string | null
  household_id: string
  /** Absent only on a legacy deployment during the additive cutover. */
  system_key?: ExpenseCategorySystemKey | null
}

export interface WireAccount {
  calculation_start_can_set?: boolean
  calculation_start_set_at?: string | null
  id: string
  name: string
  kind: WireAccountKind
  opening_balance: string
  as_of: string
  order: number
  archived_at: string | null
  household_id: string
  /** Absent only on a legacy deployment during the additive cutover. */
  system_key?: AccountSystemKey | null
}
