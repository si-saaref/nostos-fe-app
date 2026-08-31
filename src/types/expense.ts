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
   */
  createdByUserId?: string
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
