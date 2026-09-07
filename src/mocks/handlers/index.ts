import type { RequestHandler } from 'msw'
import { accountHandlers } from '@/mocks/handlers/accounts'
import { authHandlers } from '@/mocks/handlers/auth'
import { categoryHandlers } from '@/mocks/handlers/categories'
import { expenseHandlers } from '@/mocks/handlers/expenses'
import { memberHandlers } from '@/mocks/handlers/members'
import { prefsHandlers } from '@/mocks/handlers/prefs'

/** One per module the backend ships separately. Expense covers its four routes. */
export type MockDomain = 'auth' | 'expense' | 'prefs'

export type MockedDomains = Record<MockDomain, boolean>

/**
 * What is still mocked. Edit here, not in `.env` — it changes with the diff
 * that integrates a module. `VITE_ENABLE_MOCKS=false` kills the worker
 * entirely. Flip one to `true` to work offline; do not commit it.
 */
export const MOCKED: MockedDomains = {
  auth: false, // shipped 2026-09-01
  expense: false, // shipped 2026-09-07
  prefs: true, // route not built: the live API 404s
}

const DOMAIN_HANDLERS: Record<MockDomain, RequestHandler[]> = {
  auth: authHandlers,
  expense: [
    ...expenseHandlers,
    ...categoryHandlers,
    ...accountHandlers,
    ...memberHandlers,
  ],
  prefs: prefsHandlers,
}

/** Which paths belong to which domain, for the unhandled-request warning. */
const DOMAIN_PATHS: Record<MockDomain, (string | RegExp)[]> = {
  auth: ['/api/v1/auth/'],
  expense: [
    '/api/v1/expenses',
    '/api/v1/expense-types',
    '/api/v1/payment-sources',
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
  expense: true,
  prefs: true,
})
