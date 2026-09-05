export interface Expense {
  id: string
  name: string
  value: number
  typeId: string
  sourceId: string
  datePaid: string
  paidByUserId: string
  householdId: string
  /**
   * Audit stamps. Optional because the shipped list endpoint has not always
   * returned them; the UI degrades to "recorded by whoever paid" when absent.
   *
   * `updatedByAdminId` is separate from `createdByUserId` on purpose: only an
   * admin may edit, so "who recorded it" and "who last changed it" are
   * different questions, and the PRD's audit trail wants both answered.
   */
  createdByUserId?: string
  updatedByAdminId?: string | null
  createdAt?: string
  updatedAt?: string | null
}

export interface CreateExpenseInput {
  name: string
  value: number
  typeId: string
  sourceId: string
  datePaid: string
  paidByUserId: string
}

/** Sortable columns on the list endpoint. Named so a typo cannot reach the wire. */
export type ExpenseSortField = 'datePaid' | 'value' | 'name'

export type SortDirection = 'asc' | 'desc'

export interface ExpenseFilters {
  dateFrom?: string
  dateTo?: string
  typeId?: string
  sourceId?: string
  paidByUserId?: string
  search?: string
  page: number
  limit: number
  sortBy: ExpenseSortField
  sortOrder: SortDirection
}

/**
 * `GET|POST /expenses` on the wire, snake_case as the API sends and reads it.
 *
 * Written out rather than derived with a mapped type: the point of this shape
 * is to be diffable line-by-line against the API document, and a
 * `SnakeCase<Expense>` helper would hide exactly the field whose name is
 * wrong. Mapped in one direction each by `toExpense` / `toExpenseBody`.
 */
export interface WireExpense {
  id: string
  name: string
  value: number
  type_id: string
  source_id: string
  date_paid: string
  paid_by_user_id: string
  household_id: string
  created_by_user_id?: string
  updated_by_admin_id?: string | null
  created_at?: string
  updated_at?: string | null
}

/**
 * Soft-deleted rows never reach the client: `deleted_at` is a server-side
 * column, and the list route filters on it. Modelled here only so the mock
 * store can hold it — nothing in the app reads it, and the Trash view that
 * would is Phase 2.
 */
export type StoredExpense = Expense & { deletedAt: string | null }
