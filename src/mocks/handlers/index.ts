import type { RequestHandler } from 'msw'
import { accountHandlers } from '@/mocks/handlers/accounts'
import { authHandlers } from '@/mocks/handlers/auth'
import { categoryHandlers } from '@/mocks/handlers/categories'
import { expenseHandlers } from '@/mocks/handlers/expenses'
import { incomeHandlers } from '@/mocks/handlers/income'
import { incomeTypeHandlers } from '@/mocks/handlers/incomeTypes'
import { positionHandlers } from '@/mocks/handlers/positions'
import { memberHandlers } from '@/mocks/handlers/members'
import { prefsHandlers } from '@/mocks/handlers/prefs'

/**
 * One per module the backend ships separately.
 *
 * `financial` is deliberately **one** domain covering both ledgers and the
 * reference data under them — expenses, income, expense types, income types,
 * payment sources, members and positions. They cannot be mocked apart:
 *
 *   - Both ledgers point at the same `/payment-sources` and `/members`. Mock
 *     income rows carry fixture source ids; live rows carry the server's. Mock
 *     one ledger against the other's catalogue and every source on screen
 *     resolves to an em dash.
 *   - A position is `opening ± income ∓ expense` over both ledgers at once, so
 *     a live-expense / mock-income world cannot produce a correct balance for
 *     any source. Not "slightly off" — structurally unanswerable.
 *
 * So it is one flag, and flipping it moves the whole financial world at once —
 * which is what happened on 2026-09-09, when `/income`, `/income-types` and
 * `/positions` shipped and expenses came off mocks with them.
 */
export type MockDomain = 'auth' | 'financial' | 'prefs'

export type MockedDomains = Record<MockDomain, boolean>

/**
 * What is still mocked. Edit here, not in `.env` — it changes with the diff
 * that integrates a module. `VITE_ENABLE_MOCKS=false` kills the worker
 * entirely. Flip one to `true` to work offline; do not commit it.
 */
export const MOCKED: MockedDomains = {
  auth: false, // shipped 2026-09-01
  financial: false, // shipped 2026-09-09 — both ledgers, catalogue and positions
  prefs: true, // route not built: the live API 404s
}

const DOMAIN_HANDLERS: Record<MockDomain, RequestHandler[]> = {
  auth: authHandlers,
  financial: [
    ...expenseHandlers,
    ...incomeHandlers,
    ...categoryHandlers,
    ...incomeTypeHandlers,
    ...accountHandlers,
    ...memberHandlers,
    ...positionHandlers,
  ],
  prefs: prefsHandlers,
}

/** Which paths belong to which domain, for the unhandled-request warning. */
const DOMAIN_PATHS: Record<MockDomain, (string | RegExp)[]> = {
  auth: ['/api/v1/auth/'],
  financial: [
    '/api/v1/expenses',
    '/api/v1/expense-types',
    '/api/v1/payment-sources',
    '/api/v1/income-types',
    '/api/v1/income',
    '/api/v1/positions',
    /\/api\/v1\/households\/[^/]+\/members(\/|$)/,
  ],
  prefs: [/\/api\/v1\/households\/[^/]+\/prefs$/],
}

const DOMAINS = Object.keys(DOMAIN_HANDLERS) as MockDomain[]

const matches = (pathname: string, domain: MockDomain): boolean =>
  DOMAIN_PATHS[domain].some((pattern) =>
    typeof pattern === 'string'
      ? pathname.includes(pattern)
      : pattern.test(pathname),
  )

export const buildHandlers = (mocked: MockedDomains = MOCKED) =>
  DOMAINS.filter((domain) => mocked[domain]).flatMap(
    (domain) => DOMAIN_HANDLERS[domain],
  )

/** Is this request meant to leave the mock layer? */
export const isLiveApiPath = (
  pathname: string,
  mocked: MockedDomains = MOCKED,
): boolean =>
  DOMAINS.some((domain) => !mocked[domain] && matches(pathname, domain))

/** What the browser worker runs. */
export const handlers = buildHandlers()

/** For tests: all but auth, which they opt into per-case. Ignores `MOCKED`. */
export const testHandlers = buildHandlers({
  auth: false,
  financial: true,
  prefs: true,
})
