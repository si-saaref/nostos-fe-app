# Expense Live API Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Point the expense module — expenses, expense types, payment sources and members — at the real NestJS API described by `notes/Postman/nostos-api.postman_collection.json`, and close the four gaps that cutover exposes.

**Architecture:** The frontend is already written against this contract: `WireExpense` / `WireCategory` / `WireAccount` / `WireMember` and their mappers match the collection field for field, the deviations pass (commit `b644609`) reconciled the error shapes, and `5d77096` added `PATCH /expenses/:id`. What has not happened is the cutover itself: MSW still answers every non-auth request, so nothing in the module has ever met the real server. This plan makes mocking a per-domain choice (auth is already live, the expense domain joins it, household prefs stay mocked because the route does not exist), fixes the one request the live API will reject outright, teaches the mock the validations the real server performs so the mock keeps being a faithful stand-in, and ends with a smoke run against a backend on `localhost:3073`.

**Tech Stack:** React 19 · TypeScript · Vite 8 · TanStack Query 5 · axios · MSW 2 · Vitest 4 + Testing Library · Paraglide (inlang) i18n · Tailwind 4

## Global Constraints

Every task's requirements implicitly include these. All values are copied from
`notes/Postman/nostos-api.postman_collection.json` and `notes/FE-App/API-SPEC-EXPENSE.md`.

- Base URL is `${VITE_API_URL}/api/v1`; the dev backend is `http://localhost:3073`.
- Credentials are the `household.sid` session cookie, `withCredentials: true`. Never a bearer token.
- `X-Household-ID` is required on every route in this module — expenses, expense-types, payment-sources and `/households/:id/members`. A mismatch is `400 HOUSEHOLD_MISMATCH`.
- snake_case on the wire, in bodies, query parameters and response keys alike.
- Success envelope: `{ success, message?, data, meta? }` — `data` is always the resource itself.
- Error envelope: `{ success: false, error: { code, message, status_code, timestamp, path, details? } }`. **Branch on `error.code`, never on the status.**
- `PATCH` is the update verb. No `PUT` anywhere. `DELETE /expenses/:id` answers `200` with `data: null`, not `204`.
- `sort_by` is one of `date_paid` | `value` | `name`; `sort_order` is `ASC` | `DESC`, **uppercase**. An unrecognised value is a `400`, never a silent default.
- `limit` is an integer **1–500**. `page` is ≥ 1. `meta.pagination` is on every list response including an empty one, and `meta.totals` describes the whole filtered set.
- `PaymentSource.kind` is `CASH` | `BANK` | `EWALLET`, **uppercase**.
- `value` is a JSON number, `> 0`, **at most 2 decimal places**, ≤ 999,999,999,999.99. A third decimal place is a `400`, never a rounding.
- `date_paid` is `YYYY-MM-DD` and may be no later than **tomorrow UTC**.
- A missing, archived, tombstoned or foreign `type_id` / `source_id` / `paid_by_user_id` is **`422`** with `INVALID_TYPE` / `INVALID_SOURCE` / `INVALID_USER` and **no `details[]`**.
- Expense-type and payment-source names are **unique within a household**: a duplicate is `409 CONFLICT` whose `error.message` is rendered verbatim.
- i18n: `messages/id.json` is the base locale and `messages/en.json` the translation. Any new copy goes in **both**, alphabetically by key. Tests run pinned to `id`.
- TDD throughout: failing test, run it, minimal implementation, run it, commit. One commit per task.
- Every task ends green on `npm run test`, `npm run lint` and `npm run type-check`.

---

## Already in place — do not rebuild

Three passes have already landed on this branch. Read them before starting, and
do not re-implement any of it:

- `b644609` reconciled the error shapes: `expenseFieldErrors` maps `INVALID_TYPE` / `INVALID_SOURCE` / `INVALID_USER` and a 400's `details[]` onto form fields; `getErrorDetails` reads `error.details`; `AccountKind` is split into an uppercase wire union and a lowercase domain one; the invite 403 and the resend 409/429 wording.
- `5d77096` added the edit story: `useUpdateExpense`, `UpdateExpenseInput`, `toExpensePatch` (which sends only the keys the caller passed and never a `null`), the admin-only Edit control on the plate, and decimal money — `MONEY_MIN`, `MONEY_STEP`, `isValidMoney`, `averageMoney`, no client-side ceiling.
- The mappers themselves — `toExpense`, `toCategory`, `toAccount`, `toMember` and their outbound halves — already match the collection field for field, as do `unwrap` / `unwrapPage` and the `X-Household-ID` request interceptor (covered by `src/api/client.test.ts`).

What has never happened is the cutover: no request in this module has left the
mock layer.

---

## File Structure

| File                                                              | Responsibility                                                                                                                     | Task |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `src/mocks/handlers/index.ts`                                     | Composes handlers per domain; says which paths deliberately reach the real backend                                                 | 1    |
| `src/mocks/handlers/index.test.ts`                                | **New.** Guards the composition and the live-path predicate                                                                        | 1    |
| `src/mocks/server.ts`                                             | Test server — always fully mocked, independent of the dev flags                                                                    | 1    |
| `src/main.tsx`                                                    | Starts the worker; warns only for genuinely unhandled `/api/` paths                                                                | 1    |
| `.env`, `.env.example`                                            | `VITE_MOCK_EXPENSES`                                                                                                               | 1    |
| `src/modules/financial/api/expenses.ts`                           | Owns `MAX_PAGE_SIZE`, the list route's ceiling                                                                                     | 2    |
| `src/modules/financial/hooks/useItemBaselines.ts`                 | Reads the shared ceiling instead of its own copy                                                                                   | 2    |
| `src/modules/settings/components/CategorySection.tsx`             | Usage counts, within the ceiling                                                                                                   | 2    |
| `src/modules/settings/components/CategorySection.test.tsx`        | **New.** Usage counts render; a duplicate name renders the server's 409 verbatim                                                   | 2, 4 |
| `src/modules/settings/api/prefs.ts`                               | `/households/:id/prefs` — enveloped, and honest that the route is unshipped                                                        | 3    |
| `src/modules/settings/types/settings.ts`                          | `WireHouseholdPrefs`                                                                                                               | 3    |
| `src/mocks/handlers/prefs.ts`                                     | Answers the envelope the rest of the API uses                                                                                      | 3    |
| `src/utils/errors.ts`                                             | `getErrorStatus`                                                                                                                   | 3    |
| `src/modules/settings/components/PreferencesSection.tsx`          | Renders "not configurable yet" on a 404 rather than a load error                                                                   | 3    |
| `src/modules/settings/components/PreferencesSection.test.tsx`     | **New.** 404 is a note; 500 is still an error                                                                                      | 3    |
| `src/mocks/handlers/shared.ts`                                    | `errorBody` carries `details`                                                                                                      | 4, 5 |
| `src/mocks/handlers/categories.ts`, `accounts.ts`                 | 409 on a duplicate name                                                                                                            | 4    |
| `src/modules/settings/api/accounts.test.tsx` (renamed from `.ts`) | The account 409 reaches the caller with its wording                                                                                | 4    |
| `src/mocks/handlers/expenses.ts`                                  | Rejects what the live server rejects: archived/tombstoned refs, future dates, `household_id` in the body, explicit `null` on PATCH | 5    |
| `src/modules/financial/api/expenses.test.tsx`                     | Those rejections, through the hooks                                                                                                | 5    |
| `notes/BE/CUTOVER-2026-09-07.md`                                  | **New.** What the live run actually showed                                                                                         | 6    |
| `notes/FE-App/API-SPEC-EXPENSE.md`                                | §4.2, §4.3, §6 reconciled with the shipped contract                                                                                | 7    |
| `README.md`                                                       | How to run against the real backend                                                                                                | 7    |

---

### Task 1: Mocking becomes a per-domain choice

> **Superseded 2026-09-07, after review.** This task shipped a
> `VITE_MOCK_EXPENSES` environment variable. It was then replaced: an
> env flag per module does not scale — twenty modules would mean twenty flags,
> each able to drift between two `.env` files — and which module is mocked is a
> fact about the commit rather than about the machine. The declaration now lives
> in code, in the `MOCKED` map in `src/mocks/handlers/index.ts`, and
> `VITE_ENABLE_MOCKS` is the only mock-related environment variable. Everything
> else in this task stands.

Today `src/mocks/handlers/index.ts` mocks everything except auth, and `main.tsx`
hard-codes the one exemption. The expense module cannot reach the real backend
without editing source. This task turns the exemption into a flag, and keeps
`/households/:id/prefs` mocked unconditionally — that route is **not in the
Postman collection**, so it does not exist to be called.

**Files:**

- Modify: `src/mocks/handlers/index.ts` (whole file rewritten)
- Modify: `src/mocks/server.ts:1-4`
- Modify: `src/main.tsx:11-40`
- Modify: `.env`, `.env.example`
- Test: `src/mocks/handlers/index.test.ts` (create)

**Interfaces:**

- Consumes: the existing per-domain handler arrays — `authHandlers`, `expenseHandlers`, `categoryHandlers`, `accountHandlers`, `memberHandlers`, `prefsHandlers`.
- Produces:
  - `interface MockDomains { auth: boolean; expense: boolean }`
  - `buildHandlers(domains: MockDomains): RequestHandler[]`
  - `isLiveApiPath(pathname: string, domains: MockDomains): boolean`
  - `mockDomains: MockDomains` — the flags as this build read them
  - `handlers: RequestHandler[]` — `buildHandlers(mockDomains)`, for the browser worker
  - `testHandlers: RequestHandler[]` — everything but auth, for `server.ts`

- [ ] **Step 1: Write the failing test**

Create `src/mocks/handlers/index.test.ts`:

```ts
import { buildHandlers, isLiveApiPath } from '@/mocks/handlers'

/**
 * MSW keeps the path a handler was registered with on `info.path`. Asserting
 * on it rather than on array length means a handler moved between domains
 * fails the test that names the domain, not an unrelated count.
 */
const paths = (handlers: ReturnType<typeof buildHandlers>): string[] =>
  handlers.map((handler) => String(handler.info.path))

describe('buildHandlers', () => {
  it('keeps household prefs mocked when every other domain is live', () => {
    const registered = paths(buildHandlers({ auth: false, expense: false }))
    // GET and PATCH on the one path the shipped API does not serve.
    expect(registered).toEqual([
      '*/api/v1/households/:id/prefs',
      '*/api/v1/households/:id/prefs',
    ])
  })

  it('mocks expenses, both reference lists and members as one domain', () => {
    const registered = paths(buildHandlers({ auth: false, expense: true }))
    expect(registered).toEqual(
      expect.arrayContaining([
        '*/api/v1/expenses',
        '*/api/v1/expense-types',
        '*/api/v1/payment-sources',
        '*/api/v1/households/:id/members',
      ]),
    )
  })

  it('leaves auth out unless it is asked for', () => {
    const off = paths(buildHandlers({ auth: false, expense: false }))
    const on = paths(buildHandlers({ auth: true, expense: false }))
    expect(off.some((path) => path.includes('/auth/'))).toBe(false)
    expect(on.some((path) => path.includes('/auth/'))).toBe(true)
  })
})

describe('isLiveApiPath', () => {
  const allLive = { auth: false, expense: false }
  const allMocked = { auth: true, expense: true }

  it.each([
    '/api/v1/expenses',
    '/api/v1/expenses/8c14e2a0-5b73-4f19-9d62-0a3e7c81f45b',
    '/api/v1/expense-types',
    '/api/v1/payment-sources/7a2e',
    '/api/v1/households/1f0c/members',
    '/api/v1/households/1f0c/members/9b4d/resend-invite',
    '/api/v1/auth/me',
  ])('reports %s as reaching the real backend', (pathname) => {
    expect(isLiveApiPath(pathname, allLive)).toBe(true)
  })

  it('reports nothing as live when every domain is mocked', () => {
    expect(isLiveApiPath('/api/v1/expenses', allMocked)).toBe(false)
    expect(isLiveApiPath('/api/v1/auth/me', allMocked)).toBe(false)
  })

  // Prefs is never live: there is no route behind it. A warning here would be
  // the mock layer telling the truth, so it must not be suppressed.
  it('never reports household prefs as live', () => {
    expect(isLiveApiPath('/api/v1/households/1f0c/prefs', allLive)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/mocks/handlers/index.test.ts`
Expected: FAIL — `buildHandlers is not a function` / `isLiveApiPath is not exported`.

- [ ] **Step 3: Rewrite `src/mocks/handlers/index.ts`**

```ts
import { accountHandlers } from '@/mocks/handlers/accounts'
import { authHandlers } from '@/mocks/handlers/auth'
import { categoryHandlers } from '@/mocks/handlers/categories'
import { expenseHandlers } from '@/mocks/handlers/expenses'
import { memberHandlers } from '@/mocks/handlers/members'
import { prefsHandlers } from '@/mocks/handlers/prefs'

/**
 * Which domains the mock layer still answers for.
 *
 * Mocking is per-domain rather than all-or-nothing because the backend ships
 * one module at a time: auth went live first, the expense module follows, and
 * for a while the app talks to both a real server and a mock in the same
 * session. `expense` covers expenses, both reference lists and members
 * together — they cut over as one, since the ledger cannot resolve a name
 * without the roster and cannot colour a row without the types.
 */
export interface MockDomains {
  auth: boolean
  expense: boolean
}

/**
 * `/households/:id/prefs` is absent from the domains above on purpose: it is
 * mocked unconditionally. The shipped API has no such route — it is not in the
 * Postman collection, and `API-SPEC-EXPENSE.md` §6 still lists it as
 * outstanding — so there is nothing to cut over to. See Task 3 for what the
 * app does in a production build, where no mock runs at all.
 */
export const buildHandlers = ({ auth, expense }: MockDomains) => [
  ...(auth ? authHandlers : []),
  ...(expense
    ? [
        ...expenseHandlers,
        ...categoryHandlers,
        ...accountHandlers,
        ...memberHandlers,
      ]
    : []),
  ...prefsHandlers,
]

const LIVE_AUTH = '/api/v1/auth/'

const LIVE_EXPENSE = [
  '/api/v1/expenses',
  '/api/v1/expense-types',
  '/api/v1/payment-sources',
]

const LIVE_MEMBERS = /\/api\/v1\/households\/[^/]+\/members(\/|$)/

/**
 * Is this request meant to leave the mock layer?
 *
 * Used for one thing: deciding whether an unhandled request deserves a
 * warning. Under `bypass` an unmocked path is an invisible 404, so the warning
 * is the only signal that a handler stopped matching — which means it has to
 * stay loud for real gaps and silent for the domains we deliberately let
 * through.
 */
export const isLiveApiPath = (
  pathname: string,
  domains: MockDomains,
): boolean => {
  if (!domains.auth && pathname.includes(LIVE_AUTH)) return true
  if (domains.expense) return false
  return (
    LIVE_EXPENSE.some((path) => pathname.includes(path)) ||
    LIVE_MEMBERS.test(pathname)
  )
}

export const mockDomains: MockDomains = {
  auth: import.meta.env.VITE_MOCK_AUTH === 'true',
  expense: import.meta.env.VITE_MOCK_EXPENSES === 'true',
}

/** What the browser worker runs, given this build's flags. */
export const handlers = buildHandlers(mockDomains)

/**
 * What the test server runs: every domain but auth, regardless of the dev
 * flags. A test suite whose coverage depended on a `.env` value would pass or
 * fail by machine.
 */
export const testHandlers = buildHandlers({ auth: false, expense: true })
```

- [ ] **Step 4: Run the test again**

Run: `npx vitest run src/mocks/handlers/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Point the test server at `testHandlers`**

`src/mocks/server.ts`:

```ts
import { setupServer } from 'msw/node'
import { testHandlers } from '@/mocks/handlers'

/**
 * Tests are fully mocked and never reach a network. `testHandlers` rather than
 * `handlers` so `VITE_MOCK_EXPENSES` — a development convenience — cannot
 * empty the suite's backend.
 */
export const server = setupServer(...testHandlers)
```

- [ ] **Step 6: Run the whole suite to prove nothing moved**

Run: `npm run test`
Expected: PASS, same count as before this task.

- [ ] **Step 7: Teach `main.tsx` the new exemptions**

Replace the body of `enableMocking` in `src/main.tsx`. The import stays
**dynamic** — a top-level import of `@/mocks/handlers` would pull the whole
mock layer and its fixtures into the production bundle.

```ts
async function enableMocking() {
  if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS === 'false') {
    // Said out loud because the failure mode is silent: with mocks off, every
    // unshipped endpoint goes to the real API and answers 404, which looks
    // like a broken backend rather than a missing mock layer.
    console.info(
      '[msw] mocking disabled — every request goes to',
      import.meta.env.VITE_API_URL || 'the app origin',
    )
    return
  }
  const { worker } = await import('@/mocks/browser')
  const { isLiveApiPath, mockDomains } = await import('@/mocks/handlers')
  await worker.start({
    onUnhandledRequest(request, print) {
      const { pathname } = new URL(request.url)
      // Assets, HMR, fonts — never our concern.
      if (!pathname.includes('/api/')) return
      // A domain we deliberately let reach the real backend.
      if (isLiveApiPath(pathname, mockDomains)) return
      // Anything else is an endpoint nobody mocked, or a handler path that
      // stopped matching. Both are invisible 404s under 'bypass'.
      print.warning()
    },
  })
  console.info(
    '[msw] mocking enabled —',
    `auth ${mockDomains.auth ? 'mocked' : 'live'},`,
    `expense module ${mockDomains.expense ? 'mocked' : 'live'},`,
    'household prefs always mocked',
  )
}
```

- [ ] **Step 8: Add the flag to both env files**

Append to `.env.example` **and** `.env`:

```
# Set to "true" to mock the expense module (expenses, expense-types,
# payment-sources, members). Off by default: the module runs against the real
# backend at VITE_API_URL. Household prefs stay mocked either way — that route
# is not shipped.
VITE_MOCK_EXPENSES=false
```

- [ ] **Step 9: Type-check, lint, and commit**

```bash
npm run type-check && npm run lint && npm run test
git add src/mocks/handlers/index.ts src/mocks/handlers/index.test.ts src/mocks/server.ts src/main.tsx .env.example .env
git commit -m "feat: make MSW mocking a per-domain choice"
```

---

### Task 2: One page ceiling, and it is 500

`CategorySection` asks the list route for `limit: 1000` to count how many
expenses use each category. The live API rejects anything over 500 with a
`400`, and the hook has no error branch — so at cutover every usage count
silently reads zero and the archive dialog stops saying what archiving costs.
This is the same bug `useItemBaselines` already carries a comment about, which
is why the ceiling becomes one exported constant rather than a second literal.

**Files:**

- Modify: `src/modules/financial/api/expenses.ts` (add the constant near the key factory)
- Modify: `src/modules/financial/hooks/useItemBaselines.ts:37-44,94`
- Modify: `src/modules/settings/components/CategorySection.tsx:38-44`
- Test: `src/modules/settings/components/CategorySection.test.tsx` (create)

**Interfaces:**

- Consumes: `useExpenses(householdId, filters)` from Task 0 of the existing code — unchanged.
- Produces: `export const MAX_PAGE_SIZE = 500` from `@/modules/financial/api/expenses`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/settings/components/CategorySection.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/test-utils'
import { CategorySection } from '@/modules/settings/components/CategorySection'
import { MOCK_ME } from '@/mocks/fixtures/household'

/**
 * The usage count is a request the live API can refuse: `limit` is capped at
 * 500 and the mock enforces it, so asking for 1000 answers 400 and the counts
 * quietly read zero. Asserting the rendered count is the only assertion that
 * fails for that reason — the section itself reports no error, because the
 * failing query is not the one driving its error state.
 */
describe('CategorySection usage counts', () => {
  it('counts the expenses using a category', async () => {
    renderWithProviders(
      <CategorySection householdId={MOCK_ME.household_id} canManage />,
    )
    expect(
      await screen.findByText(/Dipakai \d+ pengeluaran/),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/modules/settings/components/CategorySection.test.tsx`
Expected: FAIL — no element matches `/Dipakai \d+ pengeluaran/`, because the
mock answers `400 VALIDATION_ERROR: limit must be an integer between 1 and 500`.

- [ ] **Step 3: Export the ceiling from the api module**

In `src/modules/financial/api/expenses.ts`, immediately after the
`expenseKeys` factory:

```ts
/**
 * The widest page the list route accepts (`API-SPEC-EXPENSE.md` §3.4). Larger
 * is a `400`, not a truncation — and a caller that asks for 1000 rows gets no
 * rows at all. Exported because three screens want "as many as I am allowed":
 * the tape, the baselines, and Settings' usage counts.
 */
export const MAX_PAGE_SIZE = 500
```

- [ ] **Step 4: Use it in both call sites**

In `src/modules/financial/hooks/useItemBaselines.ts`, delete the local
`MAX_PAGE_SIZE` declaration and its comment block (lines 37–44) and import the
shared one:

```ts
import { MAX_PAGE_SIZE, useExpenses } from '@/modules/financial/api/expenses'
```

In `src/modules/settings/components/CategorySection.tsx`, import it alongside
the hooks already imported from that module and change the query:

```ts
import { MAX_PAGE_SIZE, useExpenses } from '@/modules/financial/api/expenses'

// Usage count so archiving can state its consequence instead of implying one.
// Capped at the route's own ceiling: 1000 is a 400, and a rejected count
// renders as "used by nobody", which is the one wrong answer here.
const { data: expenses } = useExpenses(householdId, {
  page: 1,
  limit: MAX_PAGE_SIZE,
  sortBy: 'datePaid',
  sortOrder: 'desc',
})
```

- [ ] **Step 5: Run the test again**

Run: `npx vitest run src/modules/settings/components/CategorySection.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run type-check && npm run lint && npm run test
git add src/modules/financial/api/expenses.ts src/modules/financial/hooks/useItemBaselines.ts src/modules/settings/components/CategorySection.tsx src/modules/settings/components/CategorySection.test.tsx
git commit -m "fix: keep every list request inside the route's 500-row ceiling"
```

---

### Task 3: Household prefs has no route, and the UI should say so

`GET|PATCH /households/:id/prefs` is not in the Postman collection and not
shipped. In development it stays mocked (Task 1), but a production build runs
no worker at all, so the request 404s: `useCurrency` already degrades to `IDR`,
while `PreferencesSection` renders "Could not load." over controls that are
not broken — they are unbuilt. This task makes that distinction visible, and
brings the mock into the envelope every other route uses so the day the route
ships is a one-line change.

**Files:**

- Modify: `src/modules/settings/types/settings.ts` (add `WireHouseholdPrefs`)
- Modify: `src/modules/settings/api/prefs.ts` (whole file)
- Modify: `src/mocks/handlers/prefs.ts` (whole file)
- Modify: `src/utils/errors.ts` (add `getErrorStatus`)
- Modify: `src/modules/settings/components/PreferencesSection.tsx`
- Modify: `messages/id.json`, `messages/en.json`
- Test: `src/utils/errors.test.ts` (append), `src/modules/settings/components/PreferencesSection.test.tsx` (create)

**Interfaces:**

- Consumes: `unwrap` and `ApiEnvelope<T>` from `@/api/client` / `@/types/api`; `SectionShell`'s existing `isError` / `onRetry` props.
- Produces:
  - `interface WireHouseholdPrefs { currency: string; month_start_day: number }`
  - `getErrorStatus(error: unknown): number | undefined`
  - `useHouseholdPrefs` now returns `error` alongside `data` / `isLoading` / `isError` (it already does; the component starts reading it).

- [ ] **Step 1: Write the failing test for `getErrorStatus`**

Append to `src/utils/errors.test.ts`:

```ts
describe('getErrorStatus', () => {
  it('reads the status off an axios error', () => {
    const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST')
    error.response = { status: 404 } as AxiosError['response']
    expect(getErrorStatus(error)).toBe(404)
  })

  it('is undefined for anything that is not an axios error', () => {
    expect(getErrorStatus(new Error('boom'))).toBeUndefined()
    expect(getErrorStatus('nope')).toBeUndefined()
  })
})
```

Add `getErrorStatus` to the import at the top of that file, and `AxiosError` to
the axios import if it is not already there.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/utils/errors.test.ts`
Expected: FAIL — `getErrorStatus is not a function`.

- [ ] **Step 3: Add `getErrorStatus`**

Append to `src/utils/errors.ts`:

```ts
/**
 * The HTTP status, for the handful of decisions that genuinely turn on it.
 *
 * Clients branch on `error.code`, not the status — several codes share one.
 * The exception is a route that does not exist: a 404 with no envelope at all
 * has no code to read, and "unbuilt" is a different thing to tell a member
 * than "could not load".
 */
export const getErrorStatus = (error: unknown): number | undefined =>
  axios.isAxiosError(error) ? error.response?.status : undefined
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/utils/errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for the section**

Create `src/modules/settings/components/PreferencesSection.test.tsx`:

```tsx
import { http, HttpResponse } from 'msw'
import { screen } from '@testing-library/react'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/test/test-utils'
import { PreferencesSection } from '@/modules/settings/components/PreferencesSection'
import { MOCK_ME } from '@/mocks/fixtures/household'

const prefsFails = (status: number) =>
  server.use(
    http.get('*/api/v1/households/:id/prefs', () =>
      HttpResponse.json(
        {
          success: false,
          error: {
            code: status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: 'nope',
            status_code: status,
          },
        },
        { status },
      ),
    ),
  )

describe('PreferencesSection when the prefs route is missing', () => {
  it('says the household settings are not configurable yet, not that they failed', async () => {
    prefsFails(404)
    renderWithProviders(
      <PreferencesSection householdId={MOCK_ME.household_id} canManage />,
    )
    expect(
      await screen.findByText(/belum tersedia di server/i),
    ).toBeInTheDocument()
    expect(screen.queryByText('Gagal memuat.')).not.toBeInTheDocument()
  })

  it('still reports a real failure as a failure', async () => {
    prefsFails(500)
    renderWithProviders(
      <PreferencesSection householdId={MOCK_ME.household_id} canManage />,
    )
    expect(await screen.findByText('Gagal memuat.')).toBeInTheDocument()
  })
})
```

The assertions are in Indonesian because `src/test/setup.ts` pins the locale to
`id`, the base locale. `state_error` is `"Gagal memuat."` there.

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run src/modules/settings/components/PreferencesSection.test.tsx`
Expected: FAIL — the 404 case renders `Gagal memuat.`, and nothing matches
`belum tersedia di server`.

- [ ] **Step 7: Add the copy to both message files**

`messages/id.json` (alphabetical, next to the other `pref_` keys):

```json
  "pref_unavailable": "Mata uang dan awal bulan belum tersedia di server. Angka ditampilkan dalam IDR sampai rutenya rilis.",
```

`messages/en.json`:

```json
  "pref_unavailable": "Currency and month start are not available on the server yet. Amounts print in IDR until that route ships.",
```

- [ ] **Step 8: Put the prefs wire shape and mapper in place**

Append to `src/modules/settings/types/settings.ts`:

```ts
/**
 * `GET|PATCH /households/:id/prefs` on the wire, snake_case like every other
 * route. The endpoint is unshipped — `API-SPEC-EXPENSE.md` §6 still lists it —
 * so this shape is what the FE will accept when it arrives, and what the mock
 * answers meanwhile.
 */
export interface WireHouseholdPrefs {
  currency: string
  month_start_day: number
}
```

Rewrite `src/modules/settings/api/prefs.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import { entityKey } from '@/api/keys'
import { useInvalidatingMutation } from '@/api/useInvalidatingMutation'
import type { ApiEnvelope } from '@/types/api'
import type {
  HouseholdPrefs,
  WireHouseholdPrefs,
} from '@/modules/settings/types/settings'

/**
 * Household preferences. Owned by Settings, read app-wide through
 * `useCurrency` — a currency the household picked has to reach every figure
 * that prints money, or the control is decoration.
 *
 * The route is not shipped: it is absent from the API's own Postman
 * collection. It is mocked unconditionally in development, and in a build with
 * no mock layer it answers 404 — which `PreferencesSection` renders as "not
 * available yet" rather than as a failure. Written against the envelope and
 * snake_case anyway, so shipping it is a backend change and not a frontend one.
 */
export const prefsKeys = {
  all: (householdId: string) => entityKey(householdId, 'household-prefs'),
}

const toPrefs = (row: WireHouseholdPrefs): HouseholdPrefs => ({
  currency: row.currency,
  monthStartDay: row.month_start_day,
})

/** Only the keys the caller passed — a partial body, like every other PATCH. */
const toPrefsBody = (patch: Partial<HouseholdPrefs>) => {
  const body: Record<string, unknown> = {}
  if (patch.currency !== undefined) body.currency = patch.currency
  if (patch.monthStartDay !== undefined) {
    body.month_start_day = patch.monthStartDay
  }
  return body
}

const prefsPath = (householdId: string) => `/households/${householdId}/prefs`

export const useHouseholdPrefs = (householdId: string) =>
  useQuery({
    queryKey: prefsKeys.all(householdId),
    queryFn: async () =>
      toPrefs(
        unwrap(
          await apiClient.get<ApiEnvelope<WireHouseholdPrefs>>(
            prefsPath(householdId),
          ),
        ),
      ),
    enabled: Boolean(householdId),
  })

export const useUpdatePrefs = (householdId: string) =>
  useInvalidatingMutation(
    [prefsKeys.all(householdId)],
    async (patch: Partial<HouseholdPrefs>) =>
      toPrefs(
        unwrap(
          await apiClient.patch<ApiEnvelope<WireHouseholdPrefs>>(
            prefsPath(householdId),
            toPrefsBody(patch),
          ),
        ),
      ),
  )
```

Rewrite `src/mocks/handlers/prefs.ts` so the mock answers that envelope:

```ts
import { http } from 'msw'
import { db } from '@/mocks/db'
import {
  READ_LATENCY_MS,
  WRITE_LATENCY_MS,
  ok,
  pause,
} from '@/mocks/handlers/shared'
import type { HouseholdPrefs } from '@/modules/settings/types/settings'

/** Domain → wire. The store is camelCase; only the boundary is not. */
const toWire = (prefs: HouseholdPrefs) => ({
  currency: prefs.currency,
  month_start_day: prefs.monthStartDay,
})

/**
 * The one mock that is never switched off: there is no route behind it. It
 * answers the same envelope as everything else so the day it ships, only the
 * flag moves.
 */
export const prefsHandlers = [
  http.get('*/api/v1/households/:id/prefs', async () => {
    await pause(READ_LATENCY_MS)
    return ok(toWire(db.prefs))
  }),

  http.patch('*/api/v1/households/:id/prefs', async ({ request }) => {
    await pause(WRITE_LATENCY_MS)
    const patch = (await request.json()) as {
      currency?: string
      month_start_day?: number
    }
    db.prefs = {
      ...db.prefs,
      ...(patch.currency !== undefined && { currency: patch.currency }),
      ...(patch.month_start_day !== undefined && {
        monthStartDay: patch.month_start_day,
      }),
    }
    return ok(toWire(db.prefs))
  }),
]
```

- [ ] **Step 9: Branch the section on a 404**

In `src/modules/settings/components/PreferencesSection.tsx`, read `error` from
the query, compute the branch, and pass it down:

```tsx
import { getErrorStatus } from '@/utils/errors'
...
  const {
    data: prefs,
    isLoading,
    isError,
    error,
    refetch,
  } = useHouseholdPrefs(householdId)
  const { mutate: update, error: updateError } = useUpdatePrefs(householdId)

  /**
   * A 404 here is not a failure to report: the route is unbuilt, and the
   * controls below have nothing to save to. Telling a member "could not load"
   * invites them to retry something that will never succeed.
   */
  const notShipped = isError && getErrorStatus(error) === 404

  return (
    <SectionShell
      id={SETTINGS_ANCHORS.household}
      title={m.pref_title()}
      description={m.settings_intro()}
      canManage={canManage}
      isLoading={isLoading}
      isError={isError && !notShipped}
      onRetry={refetch}
      actionError={notShipped ? undefined : updateError}
    >
```

Inside the household card, above the two Selects, and disable them when the
route is missing:

```tsx
{
  notShipped && (
    <p className="bg-chip text-muted mt-3 rounded-lg px-3 py-2 text-[11px]">
      {m.pref_unavailable()}
    </p>
  )
}

;<div className="mt-3 flex flex-wrap gap-3">
  <Select
    label={m.pref_currency()}
    value={prefs?.currency ?? 'IDR'}
    disabled={!canManage || notShipped}
    onChange={(value) => update({ currency: value })}
    options={CURRENCIES.map((code) => ({ value: code, label: code }))}
  />

  <Select
    label={m.pref_month_start()}
    value={String(prefs?.monthStartDay ?? 1)}
    disabled={!canManage || notShipped}
    onChange={(value) => update({ monthStartDay: Number(value) })}
    options={Array.from({ length: 28 }, (_, i) => ({
      value: String(i + 1),
      label: String(i + 1),
    }))}
  />
</div>
```

- [ ] **Step 10: Run the tests**

Run: `npx vitest run src/modules/settings/components/PreferencesSection.test.tsx src/utils/errors.test.ts`
Expected: PASS.

Then the whole suite, because the prefs response shape changed:

Run: `npm run test`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
npm run type-check && npm run lint
git add src/modules/settings/api/prefs.ts src/modules/settings/types/settings.ts src/mocks/handlers/prefs.ts src/utils/errors.ts src/utils/errors.test.ts src/modules/settings/components/PreferencesSection.tsx src/modules/settings/components/PreferencesSection.test.tsx messages/id.json messages/en.json
git commit -m "feat: say household prefs are unshipped instead of failing to load them"
```

---

### Task 4: A duplicate category or account name is a 409, rendered verbatim

`API-SPEC-EXPENSE.md` §4.2 left name uniqueness undecided and said the FE would
render a `409` verbatim if the API enforced one. It does: the collection
documents `409` on `POST` and `PATCH` for both `/expense-types` and
`/payment-sources`, with a message that names the offending row. `SectionShell`
already renders `actionError` through `getErrorMessage`, so no production code
should need to change — but nothing proves it, and the mock never answers 409,
so the path has never run. This task makes the mock enforce what the server
enforces and pins the behaviour with tests.

**Files:**

- Modify: `src/mocks/handlers/categories.ts` (POST and PATCH)
- Modify: `src/mocks/handlers/accounts.ts` (POST and PATCH)
- Test: `src/modules/settings/components/CategorySection.test.tsx` (append), `src/modules/settings/api/accounts.test.tsx` (renamed from `.ts`) (append)

**Interfaces:**

- Consumes: `errorBody(status, code, message)` from `@/mocks/handlers/shared`; `SectionShell`'s `actionError` prop.
- Produces: no new exports. The mock now answers `409 CONFLICT` with `error.message` = `Kategori "Belanja" sudah ada` / `Akun "Tunai" sudah ada`.

- [ ] **Step 1: Write the failing UI test**

Append to `src/modules/settings/components/CategorySection.test.tsx`:

```tsx
import userEvent from '@testing-library/user-event'

/**
 * The API enforces name uniqueness per household and its 409 names the row.
 * That wording is the feature — "Kategori X sudah ada" tells a member which of
 * their forty categories collided, and a genericised message does not.
 */
describe('CategorySection duplicate names', () => {
  it('renders the server 409 verbatim', async () => {
    renderWithProviders(
      <CategorySection householdId={MOCK_ME.household_id} canManage />,
    )
    await screen.findByText('Belanja')

    // "+ Tambah kategori" opens the add form; "Tambah" inside it submits.
    await userEvent.click(
      screen.getByRole('button', { name: /Tambah kategori/ }),
    )
    await userEvent.type(screen.getByLabelText('Nama kategori'), 'Belanja')
    await userEvent.click(screen.getByRole('button', { name: 'Tambah' }))

    expect(
      await screen.findByText('Kategori "Belanja" sudah ada'),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/modules/settings/components/CategorySection.test.tsx`
Expected: FAIL — the mock creates a second "Belanja" and answers 201, so no
alert text appears.

- [ ] **Step 3: Enforce uniqueness in the category mock**

In `src/mocks/handlers/categories.ts`, add the helper above the handler array:

```ts
import { errorBody } from '@/mocks/handlers/shared'

/**
 * Name uniqueness within the household, matching the shipped API. Compared
 * case-insensitively on a trimmed name — "belanja " and "Belanja" are the same
 * category to a member, and a mock that let both exist would hide the 409 the
 * UI has to render.
 */
const nameTaken = (name: string, exceptId?: string): boolean =>
  db.categories.some(
    (row) =>
      row.id !== exceptId &&
      row.name.trim().toLowerCase() === name.trim().toLowerCase(),
  )

const conflict = (name: string) =>
  errorBody(409, 'CONFLICT', `Kategori "${name}" sudah ada`)
```

In the `POST` handler, before building `created`:

```ts
const name = (body.name ?? '').trim()
if (nameTaken(name)) return conflict(name)
```

and use that `name` for the created row. In the `PATCH` handler, after the
`notFound` guard:

```ts
if (body.name !== undefined && nameTaken(body.name, String(params.id))) {
  return conflict(body.name)
}
```

- [ ] **Step 4: Run the test again**

Run: `npx vitest run src/modules/settings/components/CategorySection.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing test for accounts**

Append to `src/modules/settings/api/accounts.test.tsx` (after the rename below):

```ts
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { createTestQueryClient } from '@/test/test-utils'
import { useCreateAccount } from '@/modules/settings/api/accounts'
import { getErrorCode, getErrorMessage } from '@/utils/errors'
import { db } from '@/mocks/db'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
)

describe('creating an account with a name already in use', () => {
  it('rejects with a 409 whose wording names the account', async () => {
    const taken = db.accounts[0].name

    const { result } = renderHook(() => useCreateAccount('household-001'), {
      wrapper,
    })

    await expect(
      result.current.mutateAsync({
        name: taken,
        kind: 'cash',
        openingBalance: 0,
        asOf: '2026-05-01',
      }),
    ).rejects.toBeDefined()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(getErrorCode(result.current.error)).toBe('CONFLICT')
    expect(getErrorMessage(result.current.error)).toBe(
      `Akun "${taken}" sudah ada`,
    )
  })
})
```

The wrapper is JSX, so the file has to be renamed first — do this before
adding the block above:

```bash
git mv src/modules/settings/api/accounts.test.ts src/modules/settings/api/accounts.test.tsx
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run src/modules/settings/api/accounts.test.tsx`
Expected: FAIL — the create resolves.

- [ ] **Step 7: Enforce uniqueness in the account mock**

In `src/mocks/handlers/accounts.ts`, mirroring Task 4 Step 3 exactly — the
duplication is deliberate, the two mocks are independent stand-ins:

```ts
import { errorBody } from '@/mocks/handlers/shared'

const nameTaken = (name: string, exceptId?: string): boolean =>
  db.accounts.some(
    (row) =>
      row.id !== exceptId &&
      row.name.trim().toLowerCase() === name.trim().toLowerCase(),
  )

const conflict = (name: string) =>
  errorBody(409, 'CONFLICT', `Akun "${name}" sudah ada`)
```

`POST`, before building `created`:

```ts
const name = (body.name ?? '').trim()
if (nameTaken(name)) return conflict(name)
```

`PATCH`, after the `notFound` guard:

```ts
if (body.name !== undefined && nameTaken(body.name, String(params.id))) {
  return conflict(body.name)
}
```

- [ ] **Step 8: Run both tests, then the suite**

Run: `npx vitest run src/modules/settings/api/accounts.test.tsx src/modules/settings/components/CategorySection.test.tsx`
Expected: PASS.

Run: `npm run test`
Expected: PASS — watch for existing tests that created a second row with a
seeded name; give those a distinct name rather than relaxing the mock.

- [ ] **Step 9: Commit**

```bash
npm run type-check && npm run lint
git add src/mocks/handlers/categories.ts src/mocks/handlers/accounts.ts src/modules/settings/components/CategorySection.test.tsx src/modules/settings/api/accounts.test.tsx
git commit -m "test: pin the reference-data 409 wording that Settings renders verbatim"
```

---

### Task 5: The mock rejects what the live server rejects

The mock checks that a `type_id` exists; the server also refuses one that is
**archived**, a payer who is **tombstoned**, a `date_paid` later than
**tomorrow UTC**, a body carrying `household_id`, a third decimal place, and an
explicit `null` in a PATCH body. Until the mock does the same, the frontend's
422 and 400 branches — the ones commit `b644609` built — never run in the
suite, and cutover is the first time they are exercised. This task closes that
gap.

**Files:**

- Modify: `src/mocks/handlers/shared.ts` (`errorBody` gains `details`)
- Modify: `src/mocks/handlers/expenses.ts` (POST and PATCH)
- Test: `src/modules/financial/api/expenses.test.tsx` (append)

**Interfaces:**

- Consumes: `useCreateExpense`, `useUpdateExpense` from `@/modules/financial/api/expenses`; `getErrorCode` from `@/utils/errors`; the mock store `db` from `@/mocks/db`.
- Produces:
  - `errorBody(status: number, code: string, message: string, details?: unknown)`
  - No frontend exports change.

- [ ] **Step 1: Let the mock's error envelope carry `details`**

In `src/mocks/handlers/shared.ts`:

```ts
/**
 * The documented envelope (auth PRD v3.1 §0), used by every failure path.
 * A bare `new HttpResponse(null, { status })` leaves `getErrorMessage` nothing
 * to read, so the UI falls back to axios's "Request failed with status code
 * 404" and no error copy is testable.
 *
 * `details` is omitted when absent rather than sent as `null`, which is what
 * the server does: in production it is published only for `VALIDATION_ERROR`
 * and `HOUSEHOLD_DELETION_PENDING`.
 */
export const errorBody = (
  status: number,
  code: string,
  message: string,
  details?: unknown,
) =>
  HttpResponse.json(
    {
      success: false,
      status_code: status,
      error: { code, message, ...(details !== undefined && { details }) },
    },
    { status },
  )
```

- [ ] **Step 2: Write the failing tests**

Append to `src/modules/financial/api/expenses.test.tsx`, reusing that file's
existing wrapper and constants:

```tsx
import { db } from '@/mocks/db'
import { getErrorCode } from '@/utils/errors'

/**
 * The server refuses a reference that exists but is retired — new spending
 * cannot be booked against an archived category or attributed to somebody who
 * has left, while an *existing* row may point at both. These are the 422s the
 * expense form maps onto its fields, and until the mock answered them the
 * mapping had nothing to map.
 */
describe('references the server refuses', () => {
  it('rejects a create naming an archived category with INVALID_TYPE', async () => {
    const archived = db.categories[0]
    archived.archivedAt = '2026-08-30'

    const { result } = renderHook(() => useCreateExpense(HOUSEHOLD_ID), {
      wrapper,
    })

    await expect(
      result.current.mutateAsync({
        name: 'Kopi',
        value: 23000,
        typeId: archived.id,
        sourceId: db.accounts[0].id,
        datePaid: '2026-09-04',
        paidByUserId: db.members[0].id,
      }),
    ).rejects.toBeDefined()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(getErrorCode(result.current.error)).toBe('INVALID_TYPE')
  })

  it('rejects a create attributed to a tombstoned member with INVALID_USER', async () => {
    const member = db.members[db.members.length - 1]
    member.deletedAt = '2026-08-30'

    const { result } = renderHook(() => useCreateExpense(HOUSEHOLD_ID), {
      wrapper,
    })

    await expect(
      result.current.mutateAsync({
        name: 'Kopi',
        value: 23000,
        typeId: db.categories[1].id,
        sourceId: db.accounts[0].id,
        datePaid: '2026-09-04',
        paidByUserId: member.id,
      }),
    ).rejects.toBeDefined()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(getErrorCode(result.current.error)).toBe('INVALID_USER')
  })

  /**
   * The rule that makes archive-not-delete work: an admin fixing a typo on a
   * March expense whose category has since been archived must succeed. Only
   * the refs the body actually carries are validated.
   */
  it('lets an admin edit a row whose category is archived, as long as the body does not name it', async () => {
    const archived = db.categories[0]
    archived.archivedAt = '2026-08-30'
    const row = db.expenses.find((expense) => expense.typeId === archived.id)!

    const { result } = renderHook(() => useUpdateExpense(HOUSEHOLD_ID), {
      wrapper,
    })

    const updated = await result.current.mutateAsync({
      id: row.id,
      name: 'Nama yang diperbaiki',
    })
    expect(updated.name).toBe('Nama yang diperbaiki')
  })

  it('still refuses a PATCH that names the archived category itself', async () => {
    const archived = db.categories[0]
    archived.archivedAt = '2026-08-30'
    const row = db.expenses.find((expense) => expense.typeId !== archived.id)!

    const { result } = renderHook(() => useUpdateExpense(HOUSEHOLD_ID), {
      wrapper,
    })

    await expect(
      result.current.mutateAsync({ id: row.id, typeId: archived.id }),
    ).rejects.toBeDefined()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(getErrorCode(result.current.error)).toBe('INVALID_TYPE')
  })
})

describe('the body the server refuses', () => {
  it('rejects a date beyond tomorrow UTC with FUTURE_DATE', async () => {
    const dayAfterTomorrow = new Date(Date.now() + 2 * 86_400_000)
      .toISOString()
      .slice(0, 10)

    const { result } = renderHook(() => useCreateExpense(HOUSEHOLD_ID), {
      wrapper,
    })

    await expect(
      result.current.mutateAsync({
        name: 'Kopi',
        value: 23000,
        typeId: db.categories[1].id,
        sourceId: db.accounts[0].id,
        datePaid: dayAfterTomorrow,
        paidByUserId: db.members[0].id,
      }),
    ).rejects.toBeDefined()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(getErrorCode(result.current.error)).toBe('FUTURE_DATE')
  })

  it('rejects a third decimal place with a field error on value', async () => {
    const { result } = renderHook(() => useCreateExpense(HOUSEHOLD_ID), {
      wrapper,
    })

    await expect(
      result.current.mutateAsync({
        name: 'Kopi',
        value: 10.999,
        typeId: db.categories[1].id,
        sourceId: db.accounts[0].id,
        datePaid: '2026-09-04',
        paidByUserId: db.members[0].id,
      }),
    ).rejects.toBeDefined()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(getErrorCode(result.current.error)).toBe('VALIDATION_ERROR')
    expect(getFieldErrors(result.current.error)).toEqual([
      expect.objectContaining({ field: 'value' }),
    ])
  })
})
```

Add `getFieldErrors` to the `@/utils/errors` import. `HOUSEHOLD_ID`, `wrapper`,
`renderHook` and `waitFor` already exist in this file — reuse them rather than
redeclaring. `resetMockState()` runs after every test (`src/test/setup.ts`), so
mutating `db` inside a test is safe.

- [ ] **Step 3: Run them and watch them fail**

Run: `npx vitest run src/modules/financial/api/expenses.test.tsx`
Expected: FAIL — the archived, tombstoned, future-date and third-decimal cases
all resolve with a 201; the two PATCH cases both succeed.

- [ ] **Step 4: Teach the mock the server's validations**

In `src/mocks/handlers/expenses.ts`, add above `expenseHandlers`:

```ts
/**
 * The refs a *new* row may point at. An existing row may reference an archived
 * category or a tombstoned payer — that is the whole reason those rows are
 * kept rather than deleted — but new spending may not be booked against
 * either. Answered as 422 with a code and no `details[]`, which is what the
 * form maps onto its fields.
 */
const REF_CHECKS = [
  {
    key: 'type_id' as const,
    code: 'INVALID_TYPE',
    message: 'Kategori tidak tersedia',
    live: (id: string) =>
      db.categories.some((row) => row.id === id && row.archivedAt === null),
  },
  {
    key: 'source_id' as const,
    code: 'INVALID_SOURCE',
    message: 'Metode pembayaran tidak tersedia',
    live: (id: string) =>
      db.accounts.some((row) => row.id === id && row.archivedAt === null),
  },
  {
    key: 'paid_by_user_id' as const,
    code: 'INVALID_USER',
    message: 'Anggota tidak tersedia',
    live: (id: string) =>
      db.members.some((row) => row.id === id && !row.deletedAt),
  },
]

/**
 * Only the refs the body actually carries. Re-checking `type_id` on a PATCH
 * that never mentioned it would make every row with an archived category
 * uneditable — the exact thing archive-not-delete exists to avoid.
 */
const badRef = (body: Partial<WireExpense>) => {
  for (const check of REF_CHECKS) {
    const id = body[check.key]
    if (id !== undefined && !check.live(id)) {
      return errorBody(422, check.code, check.message)
    }
  }
  return null
}

/**
 * Tomorrow UTC, not today: Jakarta is UTC+7, so a member entering today's date
 * at 01:00 local is 18:00 *yesterday* in UTC, and a naive check would reject a
 * perfectly valid entry.
 */
const tomorrowUtc = (): string =>
  new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

/**
 * The body checks the server performs, in its own order: whitelist first (an
 * unknown key is never merely ignored), then the field constraints.
 */
const badBody = (body: Record<string, unknown>) => {
  if ('household_id' in body) {
    return errorBody(
      400,
      'WHITELIST_VALIDATION',
      'property household_id should not exist',
    )
  }
  const value = body.value
  if (
    value !== undefined &&
    (typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value <= 0 ||
      Math.round(value * 100) / 100 !== value)
  ) {
    return errorBody(400, 'VALIDATION_ERROR', 'Validation failed', [
      {
        field: 'value',
        code: 'IS_DECIMAL',
        message: 'value must have at most 2 decimal places',
      },
    ])
  }
  const datePaid = body.date_paid
  if (typeof datePaid === 'string' && datePaid > tomorrowUtc()) {
    return errorBody(400, 'FUTURE_DATE', 'date_paid cannot be in the future')
  }
  return null
}
```

Replace the three inline `if` guards at the top of the `POST` handler with:

```ts
const body = (await request.json()) as Partial<WireExpense> &
  Record<string, unknown>
const rejected = badBody(body) ?? badRef(body)
if (rejected) return rejected
```

In the `PATCH` handler, after reading the body and before the `findIndex`:

```ts
// Every expense field is non-nullable, so the three-way partial-body
// distinction collapses to two here: absent leaves the field alone, and an
// explicit null is a 400 rather than being silently ignored.
const nulled = Object.keys(body).find(
  (key) => (body as Record<string, unknown>)[key] === null,
)
if (nulled) {
  return errorBody(400, 'VALIDATION_ERROR', 'Validation failed', [
    { field: nulled, code: 'IS_NOT_NULL', message: `${nulled} cannot be null` },
  ])
}
const rejected = badBody(body as Record<string, unknown>) ?? badRef(body)
if (rejected) return rejected
```

Import `db` members/categories/accounts as needed — `db` is already imported in
this file.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/modules/financial/api/expenses.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the suite**

Run: `npm run test`
Expected: PASS. If an existing test creates an expense dated today, it still
passes — today is never later than tomorrow UTC.

- [ ] **Step 7: Commit**

```bash
npm run type-check && npm run lint
git add src/mocks/handlers/shared.ts src/mocks/handlers/expenses.ts src/modules/financial/api/expenses.test.tsx
git commit -m "test: make the expense mock refuse what the live API refuses"
```

---

### Task 6: Smoke the module against the real backend

The suite proves the frontend agrees with the mock. Only a live run proves the
mock agrees with the server. This task is manual and its deliverable is a
record — every mismatch found here is either a frontend fix or a note for BE,
and both need to be written down rather than remembered.

**Files:**

- Create: `notes/BE/CUTOVER-2026-09-07.md`

- [ ] **Step 1: Start the backend and confirm it is up**

```bash
curl -s http://localhost:3073/health
```

Expected: a JSON body reporting the service healthy. If the port differs, set
`VITE_API_URL` to match before continuing.

- [ ] **Step 2: Run the frontend with the expense module live**

Confirm `.env` reads `VITE_MOCK_EXPENSES=false` (or has the line absent —
absent means live), then:

```bash
npm run dev
```

Open `http://localhost:6060` and check the console line reads
`[msw] mocking enabled — auth live, expense module live, household prefs always mocked`.

- [ ] **Step 3: Sign in as a household member**

Follow the collection's App — Auth flow: `POST /api/v1/auth/signin` from the
app's own sign-in screen, then open the magic link from the MailDev inbox or
the backend's winston output. Land on the dashboard.

- [ ] **Step 4: Walk the ledger and record what happens**

With the network tab open, check each of these and note the result:

1. The tape loads for the current month. The request carries `X-Household-ID`, `limit=400`, `sort_order=DESC`, and `date_from`/`date_to`.
2. The count strip shows a total, a count and an average — these come from `meta.totals` and cannot be derived client-side. A second request with `limit=1` fetches the previous month.
3. The month rail shows day totals and the cumulative figure tracks scrolling.
4. Sorting by value and by name changes the order (`sort_by=value`, `sort_order=ASC`).
5. Filtering by category, by account, by payer, and by search text each narrow the tape _and_ the totals.
6. Recording an expense writes an optimistic row and the server's row replaces it, fully populated.
7. Recording with a third decimal place is refused inline; recording against a category archived in another tab is refused on the category field (422 `INVALID_TYPE`).
8. As an admin, editing an expense sends `PATCH` with only the changed keys and the plate shows a fresh "edited" stamp.
9. Deleting asks for confirmation and answers `200` with `data: null`; the row leaves the tape and the totals move with it.
10. Settings: categories and accounts list archived rows, archive and restore both work, a duplicate name renders the server's 409 wording, and account `kind` renders as the right radio (uppercase on the wire).
11. Settings: the member roster lists tombstoned members, invite / resend / remove behave, and "Resend · N left" counts down from `resend_count`.
12. Settings: the household preferences card shows the "not available on the server yet" note rather than a load error.

- [ ] **Step 5: Note the two failure modes worth watching for**

- **The session cookie not being sent.** `household.sid` is set by the backend on `localhost:3073` while the app runs on `localhost:6060`; if the browser drops it on cross-origin XHR, every call 401s and the app redirects to `/signin?error=session_ended`. The fix is backend CORS (`credentials: true` plus this exact origin) and the cookie's `SameSite`. As a local workaround, `vite.config.ts` carries a commented-out `/api` proxy — uncommenting it makes the requests same-origin.
- **`400 HOUSEHOLD_MISMATCH`.** Means `X-Household-ID` disagreed with the session's household. Check `HouseholdProvider` resolved `/auth/me` before the first expense request; every hook in the module is `enabled: Boolean(householdId)` precisely to prevent this.

- [ ] **Step 6: Write down what actually happened**

Create `notes/BE/CUTOVER-2026-09-07.md` with one table: each of the twelve
checks, its result (`✅` / a one-line description of what differed), and where
the difference lives (frontend fix, backend note, or spec text). Anything
listed as a frontend fix becomes a follow-up task; do not fix it inline in this
step, so the smoke run stays a single reviewable observation.

- [ ] **Step 7: Commit the record**

```bash
git add notes/BE/CUTOVER-2026-09-07.md
git commit -m "docs: record the expense module's first run against the live API"
```

---

### Task 7: Reconcile the spec with the contract that shipped

`API-SPEC-EXPENSE.md` is the document BE built from, and three of its open
decisions are now closed by the collection. Leaving them open means the next
reader treats a settled question as negotiable.

**Files:**

- Modify: `notes/FE-App/API-SPEC-EXPENSE.md` (§4.2, §4.3, §6)
- Modify: `README.md`

- [ ] **Step 1: Close the open decisions in §6**

In the §6 table, strike through and mark resolved, matching the format the
already-resolved rows use:

- Row 5 — `kind` lowercase vs uppercase: **decided uppercase** (`CASH` / `BANK` / `EWALLET`), per the collection's Payment Sources folder and `API-SPEC-DEVIATIONS.md` #2. The FE ships `WireAccountKind` uppercase with a lowercase domain union.
- Row 6 — category/account name uniqueness: **decided enforced**. Both `POST` and `PATCH` answer `409 CONFLICT` naming the row; the FE renders `error.message` verbatim through `SectionShell`.

- [ ] **Step 2: Correct §4.2 and §4.3 in place**

- §4.2: replace "Name uniqueness within a household: undecided. The FE does not enforce it and will render a `409 CONFLICT` verbatim if the API does." with a statement that it **is** enforced, on create and on rename, and that the message names the row because that is what tells a member which of forty categories collided.
- §4.3: replace the `kind` row's "**Lowercase** — unlike `role`, which is upper. Confirm." with `CASH` | `BANK` | `EWALLET`, uppercase, matching `role` and `household_status`; and delete the closing paragraph that asks for the decision.
- §3.2: note that the shipped column is `DECIMAL(14,2)` capping at 999,999,999,999.99, per `API-SPEC-DEVIATIONS.md` #6 — the FE dropped its client-side ceiling accordingly.
- §3.4: add that `limit` above 500 is a `400`, and that `MAX_PAGE_SIZE` in `src/modules/financial/api/expenses.ts` is the single client-side copy of that number.

- [ ] **Step 3: Document how to run against the real backend**

Add a short section to `README.md` under the existing development instructions:

```markdown
### Running against the real backend

The app talks to `${VITE_API_URL}/api/v1` and authenticates with the
`household.sid` session cookie. Mocking is per-domain:

| Flag                 | Default | Effect                                                            |
| -------------------- | ------- | ----------------------------------------------------------------- |
| `VITE_ENABLE_MOCKS`  | `true`  | `false` turns the whole mock worker off                           |
| `VITE_MOCK_AUTH`     | `false` | `true` mocks `/auth/*` for offline work                           |
| `VITE_MOCK_EXPENSES` | `false` | `true` mocks expenses, expense types, payment sources and members |

`/households/:id/prefs` is mocked unconditionally — the route is not shipped,
and Settings says so rather than reporting a load failure.

Start the backend on `http://localhost:3073`, then `npm run dev`. If the
browser drops the session cookie across origins, uncomment the `/api` proxy in
`vite.config.ts` to make the requests same-origin.
```

- [ ] **Step 4: Commit**

```bash
git add notes/FE-App/API-SPEC-EXPENSE.md README.md
git commit -m "docs: close the expense spec's open decisions against the shipped API"
```

---

## Verification

After the last task:

```bash
npm run test
npm run lint
npm run type-check
npm run build
```

All four must pass. Then confirm the cutover is real rather than configured
away:

```bash
grep -n "VITE_MOCK_EXPENSES" .env .env.example
```

Expected: `false` in both, or the line absent from `.env` — either way the
expense module runs against the live backend by default.

## Not in this plan

- **A Trash view for soft-deleted expenses.** `DELETE` is a soft delete with a 7-day window, but there is no route to list or restore deleted rows — `API-SPEC-EXPENSE.md` §3.9 says so explicitly. Phase 2.
- **Building `GET|PATCH /households/:id/prefs`.** Backend work. Task 3 makes the frontend honest while it is missing; when it ships, the change is deleting `prefsHandlers` from the unconditional slot in `buildHandlers` and adding a `prefs` domain flag.
- **Per-account balances.** `opening_balance` and `as_of` are carried and uncomputed by design; nothing derives a balance until the Income module exists.
- **Cursor pagination for the tape.** The 500-row ceiling holds a month, which is what the tape asks for. Revisit only if a household exceeds it.
- **Optimistic locking on concurrent edits.** Field-level last-write-wins is the documented behaviour; `If-Match` waits for evidence that two admins editing one row is real.
