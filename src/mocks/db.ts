import { seedAccounts } from '@/mocks/fixtures/accounts'
import { seedCategories } from '@/mocks/fixtures/categories'
import { seedExpenses } from '@/mocks/fixtures/expenses'
import { seedMembers } from '@/mocks/fixtures/members'
import { seedPrefs } from '@/mocks/fixtures/prefs'
import type { Account, Category } from '@/types/catalog'
import type { Expense } from '@/types/expense'
import type { HouseholdPrefs, Member } from '@/modules/settings/types/settings'

/**
 * The mock backend's single mutable store.
 *
 * Handlers are split by context; the store deliberately is not. They mutate it
 * in place (`db.expenses.unshift`, `member.resendCount += 1`), so a per-context
 * store would hand each handler file its own copy and quietly break both
 * cross-context behaviour and `resetMockState`. Fixtures export pure seed
 * functions only — that is what makes the split safe.
 */
const activePayerIds = (members: Member[]) =>
  members.filter((member) => !member.deletedAt).map((member) => member.id)

const seedAll = () => {
  const members = seedMembers()
  return {
    expenses: seedExpenses(activePayerIds(members)),
    categories: seedCategories(),
    accounts: seedAccounts(),
    members,
    prefs: seedPrefs(),
  }
}

export const db: {
  expenses: Expense[]
  categories: Category[]
  accounts: Account[]
  members: Member[]
  prefs: HouseholdPrefs
} = seedAll()

/** Auth flag toggled by the login/logout handlers. */
export const authState = { authenticated: false }

/**
 * Monotonic ids. `Date.now()` collided inside a millisecond and could not be
 * reset, so two runs of the same test produced different ids.
 */
let idSeq = 9000
export const nextId = (prefix: string): string => `${prefix}-${++idSeq}`

/** Reset all mutable mock state — call between tests. */
export const resetMockState = (): void => {
  Object.assign(db, seedAll())
  idSeq = 9000
  authState.authenticated = false
}
