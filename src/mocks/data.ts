import type { Expense, ExpenseType, PaymentSource } from '@/types/expense'
import type { Household, User } from '@/types/household'

export const MOCK_HOUSEHOLD: Household = {
  id: 'household-001',
  name: 'The Smiths',
}

export const MOCK_USER: User = {
  id: 'user-001',
  name: 'Alex Smith',
  email: 'alex@example.com',
  role: 'admin',
  householdId: MOCK_HOUSEHOLD.id,
}

export const MOCK_TYPES: ExpenseType[] = [
  { id: 'type-groceries', name: 'Groceries' },
  { id: 'type-utilities', name: 'Utilities' },
  { id: 'type-transport', name: 'Transport' },
]

export const MOCK_SOURCES: PaymentSource[] = [
  { id: 'source-cash', name: 'Cash' },
  { id: 'source-card', name: 'Debit Card' },
]

const seedExpenses = (): Expense[] => [
  {
    id: 'exp-001',
    name: 'Weekly groceries',
    value: 150000,
    typeId: 'type-groceries',
    sourceId: 'source-card',
    datePaid: '2026-07-20',
    paidByUserId: MOCK_USER.id,
    householdId: MOCK_HOUSEHOLD.id,
  },
  {
    id: 'exp-002',
    name: 'Electricity bill',
    value: 320000,
    typeId: 'type-utilities',
    sourceId: 'source-card',
    datePaid: '2026-07-18',
    paidByUserId: MOCK_USER.id,
    householdId: MOCK_HOUSEHOLD.id,
  },
]

/** Mutable in-memory database for the mock backend. Mutate `db.expenses`. */
export const db: { expenses: Expense[] } = { expenses: seedExpenses() }

/** Auth flag toggled by the login/logout handlers. */
export const authState = { authenticated: false }

let idSeq = 100
export const nextExpenseId = (): string => `exp-${++idSeq}`

/** Reset all mutable mock state — call between tests. */
export const resetMockState = (): void => {
  db.expenses = seedExpenses()
  idSeq = 100
  authState.authenticated = false
}
