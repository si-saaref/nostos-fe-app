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
}

export type AccountKind = 'cash' | 'bank' | 'ewallet'

/**
 * Accounts are where money actually sits, shared by every module rather than
 * owned by Expense. Opening balance plus an as-of date is what eventually makes
 * a real balance derivable: opening + income − expense, per account.
 */
export interface Account {
  id: string
  name: string
  kind: AccountKind
  openingBalance: number
  /** The date the opening balance was true. */
  asOf: string
  order: number
  archivedAt: string | null
  householdId: string
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
}

export interface WireAccount {
  id: string
  name: string
  kind: AccountKind
  opening_balance: number
  as_of: string
  order: number
  archived_at: string | null
  household_id: string
}
