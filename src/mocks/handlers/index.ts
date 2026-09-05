import { accountHandlers } from '@/mocks/handlers/accounts'
import { authHandlers } from '@/mocks/handlers/auth'
import { categoryHandlers } from '@/mocks/handlers/categories'
import { expenseHandlers } from '@/mocks/handlers/expenses'
import { memberHandlers } from '@/mocks/handlers/members'
import { prefsHandlers } from '@/mocks/handlers/prefs'

/**
 * Composed by context. `browser.ts` and `server.ts` import from here and did
 * not change when the single 256-line file was split.
 *
 * Auth is absent on purpose: it is the one API that has shipped, so those
 * requests fall through to the real backend via `onUnhandledRequest: 'bypass'`.
 * Set `VITE_MOCK_AUTH=true` to work offline, and see `handlers/auth.ts` for how
 * tests opt in per-case.
 */
const mockAuth = import.meta.env.VITE_MOCK_AUTH === 'true'

export const handlers = [
  ...(mockAuth ? authHandlers : []),
  ...expenseHandlers,
  ...categoryHandlers,
  ...accountHandlers,
  ...memberHandlers,
  ...prefsHandlers,
]
