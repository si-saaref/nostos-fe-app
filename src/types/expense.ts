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

export interface Paginated<T> {
  items: T[]
  pagination: Pagination
}
