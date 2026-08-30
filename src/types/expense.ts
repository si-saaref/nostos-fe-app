export interface ExpenseType {
  id: string
  name: string
}

export interface PaymentSource {
  id: string
  name: string
}

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

export interface ExpenseFilters {
  dateFrom?: string
  dateTo?: string
  typeId?: string
  sourceId?: string
  paidByUserId?: string
  search?: string
  page: number
  limit: number
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export interface Pagination {
  total: number
  page: number
  pages: number
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

export interface Paginated<T> {
  items: T[]
  pagination: Pagination
  totals?: Totals
}
