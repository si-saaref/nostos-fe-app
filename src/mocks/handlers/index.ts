import { accountHandlers } from '@/mocks/handlers/accounts'
import { authHandlers } from '@/mocks/handlers/auth'
import { categoryHandlers } from '@/mocks/handlers/categories'
import { expenseHandlers } from '@/mocks/handlers/expenses'
import { memberHandlers } from '@/mocks/handlers/members'
import { prefsHandlers } from '@/mocks/handlers/prefs'

/**
 * Composed by context. `browser.ts` and `server.ts` import from here and did
 * not change when the single 256-line file was split.
 */
export const handlers = [
  ...authHandlers,
  ...expenseHandlers,
  ...categoryHandlers,
  ...accountHandlers,
  ...memberHandlers,
  ...prefsHandlers,
]
