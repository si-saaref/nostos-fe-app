# Signin Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the shipped signin UI to the shipped v1 auth API and build the household-deletion modal.

**Architecture:** One axios client at `${VITE_API_URL}/api/v1` unwrapping the `{success, data}` envelope. `GET /auth/me` is the session source of truth, consumed in the wire's snake_case shape. The signin POST is a TanStack mutation; pure logic (landing parsing, error mapping) stays in `signin.ts`. Unshipped endpoints keep working through MSW handlers re-pathed to `*/api/v1/…`.

**Tech Stack:** React 19, TypeScript 6 (strict, `erasableSyntaxOnly`), Vite 8, React Router 7, TanStack Query v5, axios, MSW 2, Vitest + Testing Library, Tailwind v4, Radix, Paraglide i18n.

**Spec:** `docs/superpowers/specs/2026-09-01-signin-integration-design.md`

## Global Constraints

- **No TypeScript `enum`.** `tsconfig.app.json` sets `erasableSyntaxOnly: true`, which makes `enum` a compile error. Use `as const` object + derived union, merged under one name.
- **Enum values keep server casing:** `'ADMIN'`, `'MEMBER'`, `'ACTIVE'`, `'DELETION_PENDING'`.
- **Session data stays snake_case**, exactly as the wire sends it. No camelCase mapper in this plan.
- **Tests run with the locale pinned to `'id'`** (`src/test/setup.ts` calls `overwriteGetLocale(() => 'id')`). Every UI assertion must target Indonesian copy.
- **MSW runs with `onUnhandledRequest: 'error'`** in tests. Any request without a matching handler throws. Auth handlers are unregistered, so tests needing auth must call `server.use(...authHandlers)`.
- **Mock handler paths use the `*/api/v1/…` wildcard**, never a bare `/api/v1/…`. `VITE_API_URL` is set in dev and usually absent in CI, so the resolved URL origin differs between environments; the wildcard matches both.
- **Every new user-facing string needs a key in BOTH `messages/en.json` and `messages/id.json`.** Paraglide fails the build on a missing translation.
- **Never edit `src/paraglide/`** — it is generated from `messages/*.json`.
- Run `npm run type-check && npm run lint && npm run test` before every commit.

---

### Task 1: Move the client and all mocks to `/api/v1`

Pure re-pathing. No behaviour changes, so the existing suite passing is the test.

**Files:**

- Modify: `src/api/client.ts:15`
- Modify: `src/mocks/handlers/auth.ts`, `categories.ts`, `accounts.ts`, `expenses.ts`, `members.ts`, `prefs.ts`

**Interfaces:**

- Consumes: nothing
- Produces: `apiClient` with `baseURL` = `` `${import.meta.env.VITE_API_URL ?? ''}/api/v1` ``. All later tasks call endpoints as `/auth/me`, `/expenses`, etc., with no version prefix.

- [ ] **Step 1: Run the suite to capture the green baseline**

Run: `npm run test`
Expected: PASS. Note the test count — it must not drop in this task.

- [ ] **Step 2: Change the client base URL**

In `src/api/client.ts`, replace the `axios.create` call:

```ts
export const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? ''}/api/v1`,
  withCredentials: true,
})
```

- [ ] **Step 3: Re-path every mock handler**

In each of the six handler files, change every route string from `'/api/…'` to `'*/api/v1/…'`. The complete list:

| File            | Old                                                   | New                                                       |
| --------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| `auth.ts`       | `/api/auth/login`                                     | `*/api/v1/auth/login`                                     |
| `auth.ts`       | `/api/auth/logout`                                    | `*/api/v1/auth/logout`                                    |
| `auth.ts`       | `/api/auth/session`                                   | `*/api/v1/auth/session`                                   |
| `expenses.ts`   | `/api/expenses`                                       | `*/api/v1/expenses`                                       |
| `expenses.ts`   | `/api/expenses/:id`                                   | `*/api/v1/expenses/:id`                                   |
| `categories.ts` | `/api/expense-types`                                  | `*/api/v1/expense-types`                                  |
| `categories.ts` | `/api/expense-types/:id`                              | `*/api/v1/expense-types/:id`                              |
| `accounts.ts`   | `/api/payment-sources`                                | `*/api/v1/payment-sources`                                |
| `accounts.ts`   | `/api/payment-sources/:id`                            | `*/api/v1/payment-sources/:id`                            |
| `members.ts`    | `/api/households/:id/members`                         | `*/api/v1/households/:id/members`                         |
| `members.ts`    | `/api/households/:id/members/:memberId`               | `*/api/v1/households/:id/members/:memberId`               |
| `members.ts`    | `/api/households/:id/members/:memberId/resend-invite` | `*/api/v1/households/:id/members/:memberId/resend-invite` |
| `members.ts`    | `/api/users`                                          | `*/api/v1/users`                                          |
| `prefs.ts`      | `/api/households/:id/prefs`                           | `*/api/v1/households/:id/prefs`                           |

`expenses.ts` and `categories.ts` each have both a collection and an `:id` route — re-path both. `members.ts` has GET and POST on the same collection path, and a POST whose URL sits on its own line at `members.ts:57`.

- [ ] **Step 4: Fix the one hard-coded URL in an existing test**

In `src/api/client.test.ts`, the third case builds a synthetic error with `config: { url: '/api/auth/session' }`. Change it to `'/api/v1/auth/session'`.

- [ ] **Step 5: Run the suite**

Run: `npm run type-check && npm run test`
Expected: PASS, with the same test count as Step 1. A failure here means a handler path was missed — the error names the unhandled request URL.

- [ ] **Step 6: Commit**

```bash
git add src/api src/mocks
git commit -m "refactor: move api client and mocks to /api/v1"
```

---

### Task 2: Envelope unwrapping and the 401 interceptor

The interceptor currently decides by `window.location.pathname`, which will send a user away from signin when the API legitimately answers 401 for "not invited". This is the bug the task fixes.

**Files:**

- Modify: `src/api/client.ts`
- Test: `src/api/client.test.ts`

**Interfaces:**

- Consumes: `apiClient` (Task 1)
- Produces: `unwrap<T>(res: AxiosResponse<ApiEnvelope<T>>): T` exported from `src/api/client.ts`, and `ApiEnvelope<T>` exported from `src/types/api.ts`.

- [ ] **Step 1: Write the failing tests**

Replace the third case in `src/api/client.test.ts` with these three, keeping the first two cases as they are:

```ts
const runRejection = async (error: unknown) => {
  const handlers = apiClient.interceptors.response as unknown as {
    handlers: { rejected: (e: unknown) => Promise<never> }[]
  }
  return handlers.handlers[0].rejected(error)
}

const withStubbedLocation = async (fn: (assign: Mock) => Promise<void>) => {
  const originalLocation = window.location
  const assign = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname: '/dashboard', assign },
  })
  try {
    await fn(assign)
  } finally {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  }
}

it('does not redirect on a 401 from the signin request', async () => {
  // The API answers 401 for "no active user has this address". That is an
  // inline field error, not a lost session — navigating away would swallow it.
  await withStubbedLocation(async (assign) => {
    const error = { response: { status: 401 }, config: { url: '/auth/signin' } }
    await expect(runRejection(error)).rejects.toBe(error)
    expect(assign).not.toHaveBeenCalled()
  })
})

it('does not redirect on a 401 from the anonymous /auth/me probe', async () => {
  await withStubbedLocation(async (assign) => {
    const error = { response: { status: 401 }, config: { url: '/auth/me' } }
    await expect(runRejection(error)).rejects.toBe(error)
    expect(assign).not.toHaveBeenCalled()
  })
})

it('sends any other 401 to signin with the session_ended reason', async () => {
  await withStubbedLocation(async (assign) => {
    const error = { response: { status: 401 }, config: { url: '/expenses' } }
    await expect(runRejection(error)).rejects.toBe(error)
    expect(assign).toHaveBeenCalledWith('/signin?error=session_ended')
  })
})
```

Add `import type { Mock } from 'vitest'` at the top of the file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/api/client.test.ts`
Expected: FAIL — the signin case fails because the current rule reads `window.location.pathname` (stubbed to `/dashboard`) and redirects, and the last case fails on the old `/auth/login` target.

- [ ] **Step 3: Add the envelope type**

In `src/types/api.ts`, add:

```ts
/**
 * Every v1 response is wrapped. `data` is uniformly the resource — the list
 * routes hoist their counts into `meta` rather than nesting them here
 * (BACKEND.md D15), so one unwrap works for every endpoint.
 */
export interface ApiEnvelope<T> {
  success: boolean
  data: T
  message?: string
}
```

- [ ] **Step 4: Rewrite the interceptor and add `unwrap`**

In `src/api/client.ts`, add the import and helper, and replace the response interceptor:

```ts
import type { AxiosResponse } from 'axios'
import { queryClient } from '@/api/queryClient'
import type { ApiEnvelope } from '@/types/api'

/** v1 wraps every response; the resource is always at `data.data`. */
export const unwrap = <T>(res: AxiosResponse<ApiEnvelope<T>>): T =>
  res.data.data

/**
 * Endpoints whose 401 is an answer, not a lost session.
 *
 * `/auth/signin` answers 401 for "this address was never invited" — an inline
 * field error. `/auth/me` answers 401 for every anonymous visitor, which is how
 * the app learns nobody is signed in. Redirecting on either turns a normal
 * response into a navigation.
 */
const AUTH_ENDPOINTS = ['/auth/signin', '/auth/me', '/auth/logout']

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const status =
      typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined
    const requestUrl =
      typeof error === 'object' && error !== null && 'config' in error
        ? (error as { config?: { url?: string } }).config?.url
        : undefined

    const isAuthEndpoint = AUTH_ENDPOINTS.some((path) =>
      requestUrl?.includes(path),
    )

    if (status === 401 && !isAuthEndpoint && typeof window !== 'undefined') {
      // Clear rather than invalidate: everything cached belongs to whoever was
      // signed in a moment ago. A full assign, not router navigation — this
      // runs outside React and has no `useNavigate`.
      queryClient.clear()
      window.location.assign('/signin?error=session_ended')
    }
    return Promise.reject(error)
  },
)
```

Remove the old `window.location.pathname` check entirely.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/api/client.test.ts`
Expected: PASS, 5 cases.

- [ ] **Step 6: Run the full suite**

Run: `npm run type-check && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/api src/types/api.ts
git commit -m "fix: exempt auth endpoints from the 401 redirect, add envelope unwrap"
```

---

### Task 3: `Role` and `HouseholdStatus` as const-object enums

Changes `Role` from lowercase to the server's casing and converts it to the const-object idiom. Every `Role` consumer moves in the same commit, because the type change breaks them all at once.

**Files:**

- Modify: `src/types/household.ts`
- Modify: `src/utils/permissions.ts`, `src/utils/permissions.test.ts`
- Modify: `src/modules/settings/components/MemberSection.tsx:169,202`
- Modify: `src/mocks/fixtures/members.ts`, `src/mocks/handlers/members.ts:45`
- Modify: `src/test/test-utils.tsx:41`

**Interfaces:**

- Consumes: nothing
- Produces: `Role` (value + type) and `HouseholdStatus` (value + type) from `@/types/household`. `Role.ADMIN === 'ADMIN'`, `Role.MEMBER === 'MEMBER'`. `HouseholdStatus.ACTIVE === 'ACTIVE'`, `HouseholdStatus.DELETION_PENDING === 'DELETION_PENDING'`.

- [ ] **Step 1: Write the failing test**

Replace the contents of `src/utils/permissions.test.ts`:

```ts
import { canManageExpenses } from '@/utils/permissions'
import { Role } from '@/types/household'

describe('canManageExpenses', () => {
  it('lets an admin manage', () => {
    expect(canManageExpenses(Role.ADMIN)).toBe(true)
  })

  it('does not let a member manage', () => {
    expect(canManageExpenses(Role.MEMBER)).toBe(false)
  })

  it('uses the API casing, so a lowercase role is not an admin', () => {
    // Guards the migration: the old values were 'admin'/'member'. If anything
    // still hands those through, it must not silently read as an admin.
    expect(canManageExpenses('admin' as unknown as Role)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/utils/permissions.test.ts`
Expected: FAIL — `Role` is not exported as a value, only a type.

- [ ] **Step 3: Convert the types**

In `src/types/household.ts`, replace the `Role` line and add `HouseholdStatus`, leaving `User` in place:

```ts
/**
 * The server's own casing, preserved rather than re-cased. A lowercase domain
 * copy would mean a two-way mapping to maintain and would stop matching what
 * the network tab shows during debugging.
 *
 * A const object rather than a TS `enum`: `tsconfig.app.json` sets
 * `erasableSyntaxOnly`, under which `enum` does not compile.
 */
export const Role = { ADMIN: 'ADMIN', MEMBER: 'MEMBER' } as const
export type Role = (typeof Role)[keyof typeof Role]

export const HouseholdStatus = {
  ACTIVE: 'ACTIVE',
  DELETION_PENDING: 'DELETION_PENDING',
} as const
export type HouseholdStatus =
  (typeof HouseholdStatus)[keyof typeof HouseholdStatus]
```

Leave `User`, `Household`, and `Session` alone — Task 5 removes the last two.

- [ ] **Step 4: Update the permission predicate**

In `src/utils/permissions.ts`:

```ts
import { Role } from '@/types/household'

export const canManageExpenses = (role: Role): boolean => role === Role.ADMIN
```

Note this changes the import from `import type` to a value import.

- [ ] **Step 5: Update every remaining `Role` literal**

| File                                                    | Change                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/modules/settings/components/MemberSection.tsx:169` | `member.role === 'admin'` → `member.role === Role.ADMIN`                                 |
| `src/modules/settings/components/MemberSection.tsx:202` | `member.role !== 'admin'` → `member.role !== Role.ADMIN`                                 |
| `src/mocks/fixtures/members.ts`                         | every `role: 'admin'` → `role: Role.ADMIN`, every `role: 'member'` → `role: Role.MEMBER` |
| `src/mocks/handlers/members.ts:45`                      | `role: 'member'` → `role: Role.MEMBER`                                                   |
| `src/test/test-utils.tsx:41`                            | `role: 'admin'` → `role: Role.ADMIN`                                                     |

Each file needs `import { Role } from '@/types/household'` as a value import. `MemberSection.tsx` and `mocks/fixtures/members.ts` may already import the type — merge rather than duplicate.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run type-check && npm run test`
Expected: PASS. `type-check` is the real gate here — it finds any `Role` literal missed in Step 5.

- [ ] **Step 7: Commit**

```bash
git add src/types src/utils src/modules/settings src/mocks src/test
git commit -m "refactor: Role and HouseholdStatus as const-object enums in API casing"
```

---

### Task 4: `Me`, the v1 auth mocks, and `useMe`

Additive. Nothing is deleted, so the app keeps running on `useSession` until Task 5 swaps it.

**Files:**

- Modify: `src/types/household.ts`
- Rewrite: `src/mocks/handlers/auth.ts`
- Modify: `src/mocks/handlers/index.ts`, `src/mocks/fixtures/household.ts`, `.env.example`
- Create: `src/modules/auth/api/me.ts`
- Test: `src/modules/auth/api/me.test.tsx`

**Interfaces:**

- Consumes: `unwrap` (Task 2), `Role` / `HouseholdStatus` (Task 3)
- Produces:
  - `Me` interface from `@/types/household` (fields: `user_id`, `household_id`, `household_name`, `email`, `name`, `role`, `household_status`, `scheduled_deletion_date`)
  - `meKey = ['auth', 'me'] as const` and `useMe()` from `@/modules/auth/api/me`
  - `MOCK_ME: Me` from `@/mocks/fixtures/household`
  - `authHandlers` from `@/mocks/handlers/auth`, **exported but not registered**

- [ ] **Step 1: Add the `Me` type**

In `src/types/household.ts`, after `HouseholdStatus`:

```ts
/**
 * `GET /auth/me`, exactly as the wire sends it.
 *
 * Snake_case on purpose: camelCase mapping happens per module as each one
 * integrates, so this shape stays diffable against the API docs until then.
 */
export interface Me {
  user_id: string
  household_id: string
  household_name: string
  email: string
  name: string
  role: Role
  household_status: HouseholdStatus
  scheduled_deletion_date: string | null
}
```

- [ ] **Step 2: Add the `MOCK_ME` fixture**

In `src/mocks/fixtures/household.ts`, add (keeping `MOCK_HOUSEHOLD` and `MOCK_USER`, which the roster and Task 5 still need):

```ts
import { HouseholdStatus, Role } from '@/types/household'
import type { Me } from '@/types/household'

export const MOCK_ME: Me = {
  user_id: MOCK_USER.id,
  household_id: MOCK_HOUSEHOLD.id,
  household_name: MOCK_HOUSEHOLD.name,
  email: MOCK_USER.email,
  name: MOCK_USER.name,
  role: Role.ADMIN,
  household_status: HouseholdStatus.ACTIVE,
  scheduled_deletion_date: null,
}
```

- [ ] **Step 3: Rewrite the auth handlers to v1**

Replace the whole of `src/mocks/handlers/auth.ts`:

```ts
import { http, HttpResponse } from 'msw'
import { MOCK_ME } from '@/mocks/fixtures/household'
import { authState } from '@/mocks/db'
import {
  READ_LATENCY_MS,
  WRITE_LATENCY_MS,
  errorBody,
  pause,
} from '@/mocks/handlers/shared'

/**
 * The v1 auth API, kept but NOT registered by default — auth runs against the
 * real backend now (see `handlers/index.ts`). Two things keep this from
 * rotting: tests opt in with `server.use(...authHandlers)`, and setting
 * `VITE_MOCK_AUTH=true` re-registers it for offline work.
 *
 * Two addresses drive the unhappy paths on demand:
 *   contains "belum"  → 401, never invited
 *   contains "limit"  → 429, ration spent
 *   contains "hapus"  → 403, household in its deletion grace
 */
export const authHandlers = [
  http.post('*/api/v1/auth/signin', async ({ request }) => {
    await pause(WRITE_LATENCY_MS)
    const { email } = (await request.json()) as { email: string }

    if (email.includes('belum')) {
      return errorBody(401, 'UNAUTHORIZED', 'No active user has this address')
    }
    if (email.includes('limit')) {
      return errorBody(429, 'TOO_MANY_REQUESTS', 'Too many signin requests')
    }
    if (email.includes('hapus')) {
      return HttpResponse.json(
        {
          success: false,
          status_code: 403,
          error: {
            code: 'FORBIDDEN',
            message: 'This household is being deleted.',
          },
          details: { deletion_scheduled_for: '2026-09-26' },
        },
        { status: 403 },
      )
    }

    authState.authenticated = true
    return HttpResponse.json({
      success: true,
      message: 'Check your email for a signin link',
      data: { email },
    })
  }),

  http.get('*/api/v1/auth/me', async () => {
    await pause(READ_LATENCY_MS)
    if (!authState.authenticated) {
      return errorBody(401, 'UNAUTHENTICATED', 'Not authenticated')
    }
    return HttpResponse.json({ success: true, data: MOCK_ME })
  }),

  http.post('*/api/v1/auth/logout', async () => {
    await pause(WRITE_LATENCY_MS)
    authState.authenticated = false
    return HttpResponse.json({ success: true, message: 'Logged out', data: {} })
  }),
]
```

The 403 is built inline rather than through `errorBody` because it carries a `details` object no other error has.

- [ ] **Step 4: Unregister them**

In `src/mocks/handlers/index.ts`, drop `...authHandlers` from the default array and gate it:

```ts
/**
 * Composed by context. Auth is absent on purpose: it is the one API that has
 * shipped, so those requests fall through to the real backend via
 * `onUnhandledRequest: 'bypass'`. Set `VITE_MOCK_AUTH=true` to work offline.
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
```

- [ ] **Step 5: Document the flag**

In `.env.example`, add under the mocks line:

```
# Set to "true" to also mock the auth API. Off by default: auth has shipped,
# so signin runs against the real backend at VITE_API_URL.
VITE_MOCK_AUTH=false
```

- [ ] **Step 6: Write the failing test**

Create `src/modules/auth/api/me.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { server } from '@/mocks/server'
import { authHandlers } from '@/mocks/handlers/auth'
import { authState } from '@/mocks/db'
import { createWrapper } from '@/test/test-utils'
import { useMe } from '@/modules/auth/api/me'
import { HouseholdStatus, Role } from '@/types/household'

describe('useMe', () => {
  it('unwraps the envelope into the wire shape', async () => {
    server.use(...authHandlers)
    authState.authenticated = true

    const { result } = renderHook(() => useMe(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({
      household_name: 'Keluarga Adios',
      role: Role.ADMIN,
      household_status: HouseholdStatus.ACTIVE,
      scheduled_deletion_date: null,
    })
  })

  it('does not retry the anonymous 401', async () => {
    server.use(...authHandlers)
    // authState defaults to unauthenticated via resetMockState.

    const { result } = renderHook(() => useMe(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.failureCount).toBe(1)
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run src/modules/auth/api/me.test.tsx`
Expected: FAIL — `@/modules/auth/api/me` does not exist.

- [ ] **Step 8: Write the hook**

Create `src/modules/auth/api/me.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import type { Me } from '@/types/household'
import type { ApiEnvelope } from '@/types/api'

/** Not household-scoped: this is what tells us which household to scope to. */
export const meKey = ['auth', 'me'] as const

/**
 * The session.
 *
 * `staleTime` is a minute rather than `Infinity` because the backend re-reads
 * the user on every request — this endpoint is the revocation signal, and
 * caching it forever is what would let a removed member keep browsing.
 */
export const useMe = () =>
  useQuery({
    queryKey: meKey,
    queryFn: async () =>
      unwrap(await apiClient.get<ApiEnvelope<Me>>('/auth/me')),
    staleTime: 60_000,
    retry: false,
  })
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run src/modules/auth/api/me.test.tsx`
Expected: PASS, 2 cases.

- [ ] **Step 10: Run the full suite**

Run: `npm run type-check && npm run lint && npm run test`
Expected: PASS. The existing `HouseholdContext.test.tsx` still passes because `useSession` and the old handlers are untouched — except the old auth handlers are now unregistered, so **if that test fails with an unhandled `/api/v1/auth/login` request, do not fix it here**; Task 5 rewrites it.

If it does fail, add `server.use(...authHandlers)` is _not_ the fix — the old `/auth/login` handler no longer exists. Instead, temporarily register the auth handlers for that file by adding to the top of `HouseholdContext.test.tsx`:

```tsx
import { server } from '@/mocks/server'
import { authHandlers } from '@/mocks/handlers/auth'

beforeEach(() => server.use(...authHandlers))
```

and change its `apiClient.post('/auth/login', …)` call to `apiClient.post('/auth/signin', { email: 'budi@example.com' })`, which the v1 mock accepts and which flips `authState.authenticated`. The session query still reads `/auth/session`, which no longer has a handler — so also change `useSession`'s URL in `src/modules/auth/api/session.ts` from `/auth/session` to `/auth/me` and its type to `ApiEnvelope<Me>` with `unwrap`. Task 5 then deletes that file wholesale.

- [ ] **Step 11: Commit**

```bash
git add src/types src/mocks src/modules/auth .env.example
git commit -m "feat: add Me type, v1 auth mocks, and the useMe session query"
```

---

### Task 5: Switch the context to `useMe`

Deletes `Session`, `Household`, `useSession`, and `useLogin`, and moves every consumer to the wire shape.

**Files:**

- Modify: `src/contexts/HouseholdContext.tsx`, `src/contexts/HouseholdContext.test.tsx`
- Delete: `src/modules/auth/api/session.ts`
- Modify: `src/types/household.ts`, `src/test/test-utils.tsx`
- Modify: `src/components/Layout/Sidebar.tsx:81,144`, `src/components/Layout/DashboardLayout.tsx:12,31`, `src/pages/DashboardPage.tsx:6,11`, `src/modules/settings/pages/SettingsPage.tsx:43,249,251`, `src/modules/financial/components/ExpenseForm.tsx:31,56`, `src/modules/financial/pages/ExpensesPage.tsx:24,101`

**Interfaces:**

- Consumes: `useMe`, `meKey`, `Me` (Task 4)
- Produces: `HouseholdContextValue = { me: Me | null; householdId: string; role: Role; isAuthenticated: boolean; isLoading: boolean; householdStatus: HouseholdStatus | null; scheduledDeletionDate: string | null }`

- [ ] **Step 1: Write the failing test**

Replace `src/contexts/HouseholdContext.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HouseholdProvider } from '@/contexts/HouseholdContext'
import { useHousehold } from '@/contexts/useHousehold'
import { createTestQueryClient } from '@/test/test-utils'
import { server } from '@/mocks/server'
import { authHandlers } from '@/mocks/handlers/auth'
import { authState } from '@/mocks/db'

function Probe() {
  const { isAuthenticated, householdId, isLoading, me } = useHousehold()
  if (isLoading) return <span>loading</span>
  if (!isAuthenticated) return <span>anon</span>
  return <span>{`auth:${householdId}:${me?.household_name}`}</span>
}

const renderProvider = () =>
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <HouseholdProvider>
        <Probe />
      </HouseholdProvider>
    </QueryClientProvider>,
  )

describe('HouseholdProvider', () => {
  beforeEach(() => server.use(...authHandlers))

  it('exposes an anonymous session when nobody is signed in', async () => {
    renderProvider()
    await waitFor(() => expect(screen.getByText('anon')).toBeInTheDocument())
  })

  it('exposes the household name and id from /auth/me', async () => {
    authState.authenticated = true
    renderProvider()
    await waitFor(() =>
      expect(
        screen.getByText('auth:household-001:Keluarga Adios'),
      ).toBeInTheDocument(),
    )
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/contexts/HouseholdContext.test.tsx`
Expected: FAIL — `me` is not on the context value.

- [ ] **Step 3: Rewrite the context**

Replace `src/contexts/HouseholdContext.tsx`:

```tsx
import { createContext } from 'react'
import type { ReactNode } from 'react'
import { useMe } from '@/modules/auth/api/me'
import { setHouseholdId } from '@/api/client'
import { Role } from '@/types/household'
import type { HouseholdStatus, Me } from '@/types/household'

export interface HouseholdContextValue {
  me: Me | null
  householdId: string
  role: Role
  isAuthenticated: boolean
  isLoading: boolean
  householdStatus: HouseholdStatus | null
  scheduledDeletionDate: string | null
}

// eslint-disable-next-line react-refresh/only-export-components
export const HouseholdContext = createContext<
  HouseholdContextValue | undefined
>(undefined)

export const HouseholdProvider = ({ children }: { children: ReactNode }) => {
  const { data: me, isLoading } = useMe()
  const householdId = me?.household_id ?? ''

  // Set synchronously during render (not in an effect) so the axios request
  // interceptor has the header value before any descendant's effect fires
  // its first request — e.g. a deep-link straight to /financial/expenses.
  setHouseholdId(householdId)

  const value: HouseholdContextValue = {
    me: me ?? null,
    householdId,
    role: me?.role ?? Role.MEMBER,
    isAuthenticated: Boolean(me),
    isLoading,
    householdStatus: me?.household_status ?? null,
    scheduledDeletionDate: me?.scheduled_deletion_date ?? null,
  }

  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  )
}
```

- [ ] **Step 4: Delete the old session module and dead types**

```bash
git rm src/modules/auth/api/session.ts
```

In `src/types/household.ts`, delete the `Household` and `Session` interfaces. **Keep `User`** — it is the `/users` attribution roster type that `useUsers`, `ExpenseFilter`, and `ExpenseForm` still consume.

- [ ] **Step 5: Update the test harness**

In `src/test/test-utils.tsx`, replace the `MOCK_HOUSEHOLD, MOCK_USER` import with `MOCK_ME` and rewrite the fixture value:

```tsx
import { MOCK_ME } from '@/mocks/fixtures/household'

export const TEST_HOUSEHOLD_VALUE: HouseholdContextValue = {
  me: MOCK_ME,
  householdId: MOCK_ME.household_id,
  role: MOCK_ME.role,
  isAuthenticated: true,
  isLoading: false,
  householdStatus: MOCK_ME.household_status,
  scheduledDeletionDate: MOCK_ME.scheduled_deletion_date,
}
```

- [ ] **Step 6: Update every consumer**

| File:line                                 | From                                                            | To                                                 |
| ----------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| `Layout/Sidebar.tsx:81`                   | `const { household, user } = useHousehold()`                    | `const { me } = useHousehold()`                    |
| `Layout/Sidebar.tsx:137`                  | `(user?.name ?? 'NN')`                                          | `(me?.name ?? 'NN')`                               |
| `Layout/Sidebar.tsx:141`                  | `{user?.name}`                                                  | `{me?.name}`                                       |
| `Layout/Sidebar.tsx:144`                  | `{household?.name}`                                             | `{me?.household_name}`                             |
| `Layout/DashboardLayout.tsx:12`           | `const { user } = useHousehold()`                               | `const { me } = useHousehold()`                    |
| `Layout/DashboardLayout.tsx:31`           | `(user?.name ?? 'NN')`                                          | `(me?.name ?? 'NN')`                               |
| `pages/DashboardPage.tsx:6`               | `const { user, household } = useHousehold()`                    | `const { me } = useHousehold()`                    |
| `pages/DashboardPage.tsx:11`              | `{user?.name} · {household?.name}`                              | `{me?.name} · {me?.household_name}`                |
| `settings/pages/SettingsPage.tsx:43`      | `const { householdId, household, role, user } = useHousehold()` | `const { householdId, me, role } = useHousehold()` |
| `settings/pages/SettingsPage.tsx:249`     | `householdName={household?.name ?? ''}`                         | `householdName={me?.household_name ?? ''}`         |
| `settings/pages/SettingsPage.tsx:251`     | `currentUserId={user?.id ?? ''}`                                | `currentUserId={me?.user_id ?? ''}`                |
| `financial/components/ExpenseForm.tsx:31` | `const { householdId, user } = useHousehold()`                  | `const { householdId, me } = useHousehold()`       |
| `financial/components/ExpenseForm.tsx:56` | `paidByUserId: user?.id ?? ''`                                  | `paidByUserId: me?.user_id ?? ''`                  |
| `financial/pages/ExpensesPage.tsx:24`     | `const { householdId, role, user } = useHousehold()`            | `const { householdId, role, me } = useHousehold()` |
| `financial/pages/ExpensesPage.tsx:101`    | `expense.paidByUserId === user?.id`                             | `expense.paidByUserId === me?.user_id`             |

Line numbers are from commit `a1a9cc5`; if they have drifted, `type-check` names every site.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run type-check && npm run test`
Expected: PASS. `type-check` is the gate — it finds any consumer missed in Step 6.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: make /auth/me the session source of truth"
```

---

### Task 6: Routes — add `/signin`, remove the legacy pair

**Files:**

- Modify: `src/routes/index.tsx`, `src/routes/ProtectedRoute.tsx`, `src/routes/ProtectedRoute.test.tsx`
- Delete: `src/modules/auth/pages/LoginPage.tsx`, `src/modules/auth/components/LoginForm.tsx`, `src/modules/auth/components/LoginForm.test.tsx`, `src/components/Layout/AuthLayout.tsx`
- Modify: `src/modules/auth/types/auth.ts`

**Interfaces:**

- Consumes: `HouseholdContextValue` (Task 5)
- Produces: `/signin` as the only public route.

- [ ] **Step 1: Write the failing test**

In `src/routes/ProtectedRoute.test.tsx`, change the fallback route and the two assertions:

```tsx
<Route path="/signin" element={<div>signin screen</div>} />
```

```tsx
it('sends an unauthenticated visitor to signin', () => {
  renderAt({ ...TEST_HOUSEHOLD_VALUE, isAuthenticated: false, me: null })
  expect(screen.getByText('signin screen')).toBeInTheDocument()
})
```

Note `user: null` becomes `me: null` — the old property no longer exists.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/routes/ProtectedRoute.test.tsx`
Expected: FAIL — `ProtectedRoute` still navigates to `/auth/login`, which has no route in the test, so nothing renders.

- [ ] **Step 3: Point `ProtectedRoute` at signin**

In `src/routes/ProtectedRoute.tsx`, change the redirect target:

```tsx
if (!isAuthenticated) return <Navigate to="/signin" replace />
```

- [ ] **Step 4: Rewrite the router**

In `src/routes/index.tsx`, remove the `AuthLayout` and `LoginPage` imports and replace the first two route entries with one:

```tsx
  // The only public route. The backend hardcodes `/signin` onto APP_URL when
  // it redirects a spent magic link, so this path is not ours to rename.
  {
    path: '/signin',
    element: <SigninPage />,
    errorElement: <ErrorPage />,
  },
```

Everything from the `ProtectedRoute` entry down is unchanged.

- [ ] **Step 5: Delete the password login**

```bash
git rm src/modules/auth/pages/LoginPage.tsx \
       src/modules/auth/components/LoginForm.tsx \
       src/modules/auth/components/LoginForm.test.tsx \
       src/components/Layout/AuthLayout.tsx
```

In `src/modules/auth/types/auth.ts`, delete the `LoginInput` interface.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run type-check && npm run lint && npm run test`
Expected: PASS. `lint` matters here — `noUnusedLocals` catches imports left behind in `routes/index.tsx`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: serve signin at /signin, remove the legacy password login"
```

---

### Task 7: Landing parsing and signin error mapping

Pure functions, no React, no network.

**Files:**

- Modify: `src/modules/auth/types/auth.ts`, `src/modules/auth/signin/signin.ts`
- Test: `src/modules/auth/signin/signin.test.ts`

**Interfaces:**

- Consumes: nothing
- Produces:
  - `SigninError` (value + type), `LandingReason` (value + type), `Landing` interface from `@/modules/auth/types/auth`
  - `landingFromParams(params: URLSearchParams): Landing | null`
  - `signinErrorFromResponse(error: unknown): SigninError`
  - `deletionDeadlineFromResponse(error: unknown): string | null`
  - `LINK_TTL_MINUTES`, `MAX_REQUESTS_PER_HOUR` unchanged

- [ ] **Step 1: Replace the signin types**

In `src/modules/auth/types/auth.ts`, delete `SigninErrorKind`, `SigninState`, and `SigninResult`, and add:

```ts
export const SigninError = {
  FORMAT: 'format',
  NOT_INVITED: 'not_invited',
  RATE_LIMITED: 'rate_limited',
  NETWORK: 'network',
} as const
export type SigninError = (typeof SigninError)[keyof typeof SigninError]

export const LandingReason = {
  EXPIRED_LINK: 'expired_link',
  SESSION_ENDED: 'session_ended',
  HOUSEHOLD_UNAVAILABLE: 'household_unavailable',
  ALREADY_IN_HOUSEHOLD: 'already_in_household',
  DELETION_PENDING: 'deletion_pending',
} as const
export type LandingReason = (typeof LandingReason)[keyof typeof LandingReason]

/** Why the visitor was bounced back here, read from the URL. */
export interface Landing {
  reason: LandingReason
  /** DELETION_PENDING only: the YYYY-MM-DD deadline from `until`. */
  until?: string
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/modules/auth/signin/signin.test.ts`:

```ts
import {
  deletionDeadlineFromResponse,
  landingFromParams,
  signinErrorFromResponse,
} from '@/modules/auth/signin/signin'
import { LandingReason, SigninError } from '@/modules/auth/types/auth'

const params = (query: string) => new URLSearchParams(query)

describe('landingFromParams', () => {
  it('returns null for a clean arrival', () => {
    expect(landingFromParams(params(''))).toBeNull()
  })

  it.each([
    ['error=invalid_link', LandingReason.EXPIRED_LINK],
    ['error=session_ended', LandingReason.SESSION_ENDED],
    ['error=household_unavailable', LandingReason.HOUSEHOLD_UNAVAILABLE],
    ['error=already_in_household', LandingReason.ALREADY_IN_HOUSEHOLD],
  ])('reads %s', (query, reason) => {
    expect(landingFromParams(params(query))).toEqual({ reason })
  })

  it('reads the deletion grace with its deadline', () => {
    expect(
      landingFromParams(params('household=deletion_pending&until=2026-09-26')),
    ).toEqual({ reason: LandingReason.DELETION_PENDING, until: '2026-09-26' })
  })

  it('falls back to unavailable when the deadline is missing', () => {
    // The modal is a deadline and nothing else, so one without a date would be
    // a dialog that says nothing.
    expect(landingFromParams(params('household=deletion_pending'))).toEqual({
      reason: LandingReason.HOUSEHOLD_UNAVAILABLE,
    })
  })

  it('falls back to unavailable when the deadline is malformed', () => {
    expect(
      landingFromParams(
        params('household=deletion_pending&until=next+tuesday'),
      ),
    ).toEqual({ reason: LandingReason.HOUSEHOLD_UNAVAILABLE })
  })

  it('ignores an unknown error code', () => {
    expect(landingFromParams(params('error=who_knows'))).toBeNull()
  })
})

describe('signinErrorFromResponse', () => {
  const withStatus = (status: number) => ({
    isAxiosError: true,
    response: { status, data: {} },
  })

  it.each([
    [400, SigninError.FORMAT],
    [401, SigninError.NOT_INVITED],
    [429, SigninError.RATE_LIMITED],
    [500, SigninError.NETWORK],
  ])('maps %i', (status, expected) => {
    expect(signinErrorFromResponse(withStatus(status))).toBe(expected)
  })

  it('maps a request that never got a response', () => {
    expect(signinErrorFromResponse({ isAxiosError: true })).toBe(
      SigninError.NETWORK,
    )
  })
})

describe('deletionDeadlineFromResponse', () => {
  it('reads the deadline out of a 403', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 403,
        data: { details: { deletion_scheduled_for: '2026-09-26' } },
      },
    }
    expect(deletionDeadlineFromResponse(error)).toBe('2026-09-26')
  })

  it('returns null for any other status', () => {
    expect(
      deletionDeadlineFromResponse({
        isAxiosError: true,
        response: { status: 401 },
      }),
    ).toBeNull()
  })

  it('returns null when a 403 carries no deadline', () => {
    expect(
      deletionDeadlineFromResponse({
        isAxiosError: true,
        response: { status: 403, data: {} },
      }),
    ).toBeNull()
  })
})
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/modules/auth/signin/signin.test.ts`
Expected: FAIL — `signinErrorFromResponse` and `deletionDeadlineFromResponse` are not exported.

- [ ] **Step 4: Rewrite `signin.ts`**

Replace `src/modules/auth/signin/signin.ts`:

```ts
import axios from 'axios'
import { LandingReason, SigninError } from '@/modules/auth/types/auth'
import type { Landing } from '@/modules/auth/types/auth'

/**
 * Signin behaviour, kept apart from any scene so all of them share one rule
 * set. Everything here is pure: no network, no React, no DOM.
 */

/** From the API doc: the link is single-use and short-lived. */
export const LINK_TTL_MINUTES = 15

/** From the API doc: 3 requests per address per hour. */
export const MAX_REQUESTS_PER_HOUR = 3

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

const LANDING_BY_ERROR: Record<string, LandingReason> = {
  invalid_link: LandingReason.EXPIRED_LINK,
  session_ended: LandingReason.SESSION_ENDED,
  household_unavailable: LandingReason.HOUSEHOLD_UNAVAILABLE,
  already_in_household: LandingReason.ALREADY_IN_HOUSEHOLD,
}

export const landingFromParams = (params: URLSearchParams): Landing | null => {
  if (params.get('household') === 'deletion_pending') {
    const until = params.get('until')
    // `until` is URL text rendered as a date. Without a valid one the modal
    // would open saying nothing, so fall back to the generic notice.
    return until && ISO_DAY.test(until)
      ? { reason: LandingReason.DELETION_PENDING, until }
      : { reason: LandingReason.HOUSEHOLD_UNAVAILABLE }
  }

  const error = params.get('error')
  const reason = error ? LANDING_BY_ERROR[error] : undefined
  return reason ? { reason } : null
}

const statusOf = (error: unknown): number | undefined =>
  axios.isAxiosError(error) ? error.response?.status : undefined

export const signinErrorFromResponse = (error: unknown): SigninError => {
  switch (statusOf(error)) {
    case 400:
      return SigninError.FORMAT
    case 401:
      return SigninError.NOT_INVITED
    case 429:
      return SigninError.RATE_LIMITED
    default:
      return SigninError.NETWORK
  }
}

/**
 * The 403 is not an inline error — it opens the deletion modal, and the modal
 * is useless without this date.
 */
export const deletionDeadlineFromResponse = (error: unknown): string | null => {
  if (statusOf(error) !== 403) return null
  const data = axios.isAxiosError(error)
    ? (error.response?.data as
        { details?: { deletion_scheduled_for?: string } } | undefined)
    : undefined
  return data?.details?.deletion_scheduled_for ?? null
}
```

The `submitSignin` stub is deleted with this rewrite.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/modules/auth/signin/signin.test.ts`
Expected: PASS, 17 cases.

`type-check` will now fail on `SigninCard.tsx` and `scenes.tsx`, which still reference the deleted stub and types. That is expected — Task 8 fixes them. Do not commit yet.

- [ ] **Step 6: Commit with the next task**

This task's deliverable is not independently green: deleting `submitSignin` breaks the card that calls it. Proceed straight to Task 8 and commit both together.

---

### Task 8: Wire the card to the real endpoint

**Files:**

- Create: `src/modules/auth/api/signin.ts`
- Modify: `src/modules/auth/signin/SigninCard.tsx`, `src/modules/auth/signin/scenes.tsx`, `src/modules/auth/pages/SigninPage.tsx`
- Modify: `messages/en.json`, `messages/id.json`
- Test: `src/modules/auth/signin/SigninCard.test.tsx`

**Interfaces:**

- Consumes: `landingFromParams`, `signinErrorFromResponse`, `deletionDeadlineFromResponse`, `Landing`, `SigninError`, `LandingReason` (Task 7); `apiClient` (Task 1)
- Produces: `useRequestSigninLink()` returning a TanStack `UseMutationResult<{ email: string }, unknown, string>` — `mutate` takes the email as a bare string. `SigninCard` props become `{ landing: Landing | null; showLogo?: boolean; align?: 'left' | 'center' }`.

- [ ] **Step 1: Add the new copy**

Add to `messages/en.json`:

```json
"land_already_body": "That address is already active in another household. Ask them to leave it first, then use a fresh invite.",
"land_already_title": "Already in a household",
"land_unavailable_body": "This household is no longer available. Ask whoever invited you to check on it.",
"land_unavailable_title": "Household unavailable",
```

And to `messages/id.json`:

```json
"land_already_body": "Alamat itu masih aktif di rumah lain. Minta keluar dari sana dulu, lalu pakai undangan baru.",
"land_already_title": "Sudah tergabung di rumah lain",
"land_unavailable_body": "Rumah ini sudah tidak tersedia. Tanyakan ke yang mengundangmu.",
"land_unavailable_title": "Rumah tidak tersedia",
```

Keys in both files are sorted alphabetically — insert them in order, next to the existing `land_*` keys.

- [ ] **Step 2: Write the failing tests**

Replace `src/modules/auth/signin/SigninCard.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'
import { authHandlers } from '@/mocks/handlers/auth'
import { SigninCard } from '@/modules/auth/signin/SigninCard'
import { LandingReason } from '@/modules/auth/types/auth'

const submit = async (email: string) => {
  await userEvent.type(screen.getByLabelText(/email/i), email)
  await userEvent.click(screen.getByRole('button', { name: /kirim tautan/i }))
}

describe('SigninCard', () => {
  beforeEach(() => server.use(...authHandlers))

  it('rejects a non-ASCII address without sending', async () => {
    renderWithProviders(<SigninCard landing={null} />)
    await submit('sari@café.com')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /format email tidak valid/i,
    )
    expect(screen.queryByText(/cek emailmu/i)).not.toBeInTheDocument()
  })

  it('replaces the form with the sent state and names the address', async () => {
    renderWithProviders(<SigninCard landing={null} />)
    await submit('sari@email.com')

    expect(await screen.findByText(/cek emailmu/i)).toBeInTheDocument()
    expect(screen.getByText(/sari@email\.com/)).toBeInTheDocument()
    // The form is gone, not merely hidden behind a toast.
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  })

  it('states the remaining resends', async () => {
    renderWithProviders(<SigninCard landing={null} />)
    await submit('sari@email.com')

    const resend = await screen.findByRole('button', { name: /kirim ulang/i })
    expect(resend).toHaveTextContent(/sisa 2/i)
  })

  it('stays on the sent screen while a resend is in flight', async () => {
    // Guards the latch: TanStack flips isSuccess back to false on re-mutate,
    // so a view keyed on it would flash the form back mid-resend.
    renderWithProviders(<SigninCard landing={null} />)
    await submit('sari@email.com')

    await userEvent.click(
      await screen.findByRole('button', { name: /kirim ulang/i }),
    )
    expect(screen.getByText(/cek emailmu/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  })

  it('returns to a clean form when the address was wrong', async () => {
    renderWithProviders(<SigninCard landing={null} />)
    await submit('sari@email.com')

    await userEvent.click(
      await screen.findByRole('button', { name: /ubah email/i }),
    )
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.queryByText(/cek emailmu/i)).not.toBeInTheDocument()
  })

  it('surfaces a 401 as a recoverable field error', async () => {
    renderWithProviders(<SigninCard landing={null} />)
    await submit('belum@email.com')

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/belum terdaftar/i),
    )
    // Still on the form, so the fix is one keystroke away.
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('surfaces a 429 as the rate-limit message', async () => {
    renderWithProviders(<SigninCard landing={null} />)
    await submit('limit@email.com')

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /terlalu banyak percobaan/i,
      ),
    )
  })

  it('explains why the visitor was bounced back here', () => {
    renderWithProviders(
      <SigninCard landing={{ reason: LandingReason.EXPIRED_LINK }} />,
    )
    expect(screen.getByText(/tautan sudah tidak berlaku/i)).toBeInTheDocument()
  })

  it('explains an address already active elsewhere', () => {
    renderWithProviders(
      <SigninCard landing={{ reason: LandingReason.ALREADY_IN_HOUSEHOLD }} />,
    )
    expect(
      screen.getByText(/sudah tergabung di rumah lain/i),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/modules/auth/signin/SigninCard.test.tsx`
Expected: FAIL to compile — `SigninCard` still imports the deleted `submitSignin`.

- [ ] **Step 4: Write the mutation hook**

Create `src/modules/auth/api/signin.ts`:

```ts
import { useMutation } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import type { ApiEnvelope } from '@/types/api'

/**
 * Request a magic link.
 *
 * A plain mutation, not `useInvalidatingMutation`: this makes no cached read
 * stale. Nothing about the session changes until the link is clicked, which
 * happens in a different tab entirely.
 *
 * Mutations default to `retry: 0` in TanStack v5, which is what we want — the
 * API rations three links per address per hour, so a silent retry would spend
 * somebody's allowance.
 */
export const useRequestSigninLink = () =>
  useMutation({
    mutationFn: async (email: string) =>
      unwrap(
        await apiClient.post<ApiEnvelope<{ email: string }>>('/auth/signin', {
          email,
        }),
      ),
  })
```

- [ ] **Step 5: Rewire the card**

In `src/modules/auth/signin/SigninCard.tsx`, replace the imports, props, and state block. Everything from `const errorText` down keeps its markup; only the values feeding it change.

```tsx
import { useEffect, useId, useRef, useState } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { Logo } from '@/components/Logo'
import { useRequestSigninLink } from '@/modules/auth/api/signin'
import {
  LINK_TTL_MINUTES,
  MAX_REQUESTS_PER_HOUR,
  signinErrorFromResponse,
} from '@/modules/auth/signin/signin'
import { isAsciiEmail } from '@/utils/validators'
import { LandingReason, SigninError } from '@/modules/auth/types/auth'
import type { Landing } from '@/modules/auth/types/auth'

interface Props {
  landing: Landing | null
  /** Scenes that already show the mark in their own chrome suppress it here. */
  showLogo?: boolean
  align?: 'left' | 'center'
}

export const SigninCard = ({
  landing,
  showLogo = true,
  align = 'left',
}: Props) => {
  const m = useMessages()
  const fieldId = useId()
  const [email, setEmail] = useState('')
  const [formatError, setFormatError] = useState(false)
  // The latch. TanStack flips `isSuccess` back to false the moment a resend
  // starts, so the sent view cannot be keyed on it — this counter both holds
  // the view and drives the "n left" copy.
  const [sendsUsed, setSendsUsed] = useState(0)
  const sentHeading = useRef<HTMLParagraphElement>(null)

  const request = useRequestSigninLink()

  // The form is gone once the link is sent, so focus has to go somewhere real
  // or a screen-reader user is left on a button that no longer exists.
  useEffect(() => {
    if (sendsUsed > 0) sentHeading.current?.focus()
  }, [sendsUsed])

  const send = (address: string) => {
    setFormatError(false)
    request.mutate(address, {
      onSuccess: () => setSendsUsed((used) => used + 1),
    })
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!isAsciiEmail(email)) {
      setFormatError(true)
      return
    }
    send(email)
  }

  const changeEmail = () => {
    request.reset()
    setSendsUsed(0)
    setFormatError(false)
  }

  const errorText: Record<SigninError, string> = {
    [SigninError.FORMAT]: m.signin_err_format(),
    [SigninError.NOT_INVITED]: m.signin_err_not_invited(),
    [SigninError.RATE_LIMITED]: m.signin_err_rate(),
    [SigninError.NETWORK]: m.signin_err_network(),
  }

  const error = formatError
    ? SigninError.FORMAT
    : request.error
      ? signinErrorFromResponse(request.error)
      : undefined

  const sending = request.isPending
  const sentEmail = request.variables ?? email
  const centred = align === 'center'
```

In the sent-view branch, change the guard and the counter:

```tsx
  if (sendsUsed > 0) {
    const left = MAX_REQUESTS_PER_HOUR - sendsUsed
```

replace `state.email` with `sentEmail`, replace the resend button's `onClick` with `() => send(sentEmail)`, and replace the "Change email" button's `onClick` with `changeEmail`. Add the failed-resend branch immediately above the `{left > 0 ? … }` block:

```tsx
{
  error && (
    <p
      role="alert"
      className="border-danger-line bg-danger-bg text-danger mt-3.5 rounded-lg border px-3 py-2 text-[11px] leading-relaxed"
    >
      {errorText[error]}
    </p>
  )
}
```

and change the resend condition to `left > 0 && !error`, so a refused resend shows the reason instead of a button that will refuse again.

In the landing notice block, replace the two-way ternaries with a lookup, since there are now four notice reasons:

```tsx
{
  landing && landing.reason !== LandingReason.DELETION_PENDING && (
    <div role="status" className="bg-chip mt-4 rounded-lg px-3 py-2.5">
      <p className="text-[12px] font-semibold">
        {
          {
            [LandingReason.EXPIRED_LINK]: m.land_expired_title(),
            [LandingReason.SESSION_ENDED]: m.land_ended_title(),
            [LandingReason.HOUSEHOLD_UNAVAILABLE]: m.land_unavailable_title(),
            [LandingReason.ALREADY_IN_HOUSEHOLD]: m.land_already_title(),
          }[landing.reason]
        }
      </p>
      <p className="text-muted mt-1 text-[11px] leading-relaxed">
        {
          {
            [LandingReason.EXPIRED_LINK]: m.land_expired_body(),
            [LandingReason.SESSION_ENDED]: m.land_ended_body(),
            [LandingReason.HOUSEHOLD_UNAVAILABLE]: m.land_unavailable_body(),
            [LandingReason.ALREADY_IN_HOUSEHOLD]: m.land_already_body(),
          }[landing.reason]
        }
      </p>
    </div>
  )
}
```

The `DELETION_PENDING` guard is there because Task 9 renders that reason as a modal, not a strip.

Note `isAsciiEmail` now comes from `@/utils/validators`, where the codebase already keeps it — the copy in `signin.ts` is gone.

- [ ] **Step 6: Update the scene and page prop types**

In `src/modules/auth/signin/scenes.tsx`, change the `SceneProps` interface:

```tsx
import type { Landing } from '@/modules/auth/types/auth'

interface SceneProps {
  landing: Landing | null
}
```

All three scenes keep passing `landing` through unchanged. `src/modules/auth/pages/SigninPage.tsx` needs no change — `landingFromParams` already returns the new type.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/modules/auth/signin/`
Expected: PASS, 9 card cases plus 17 from `signin.test.ts`.

- [ ] **Step 8: Run the full suite**

Run: `npm run type-check && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: send signin links through the real v1 endpoint"
```

---

### Task 9: The household-deletion modal

**Files:**

- Create: `src/modules/auth/signin/HouseholdDeletionModal.tsx`
- Test: `src/modules/auth/signin/HouseholdDeletionModal.test.tsx`
- Modify: `src/modules/auth/signin/SigninCard.tsx`, `src/components/ConfirmDialog.tsx:18-22`
- Modify: `messages/en.json`, `messages/id.json`

**Interfaces:**

- Consumes: `deletionDeadlineFromResponse`, `Landing`, `LandingReason` (Task 7); `formatDate` from `@/utils/formatters`
- Produces: `HouseholdDeletionModal` with props `{ deadline: string | null; onDismiss: () => void }`. A non-null `deadline` is what opens it.

- [ ] **Step 1: Add the copy**

Add to `messages/en.json`:

```json
"deletion_back": "Back to sign in",
"deletion_body": "Access returns only if it is restored before {date}.",
"deletion_note": "Ask your household admin if you think this is a mistake.",
"deletion_title": "This household is being deleted",
```

And to `messages/id.json`:

```json
"deletion_back": "Kembali ke halaman masuk",
"deletion_body": "Akses hanya kembali jika rumah dipulihkan sebelum {date}.",
"deletion_note": "Tanyakan ke admin rumahmu kalau ini keliru.",
"deletion_title": "Rumah ini sedang dihapus",
```

- [ ] **Step 2: Write the failing tests**

Create `src/modules/auth/signin/HouseholdDeletionModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { HouseholdDeletionModal } from '@/modules/auth/signin/HouseholdDeletionModal'

const renderModal = (deadline: string | null, onDismiss = vi.fn()) => {
  render(
    <SettingsProvider>
      <HouseholdDeletionModal deadline={deadline} onDismiss={onDismiss} />
    </SettingsProvider>,
  )
  return onDismiss
}

describe('HouseholdDeletionModal', () => {
  it('stays shut without a deadline', () => {
    renderModal(null)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('announces itself as an alert dialog and states the deadline', () => {
    renderModal('2026-09-26')
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent(/rumah ini sedang dihapus/i)
    expect(dialog).toHaveTextContent(/2026/)
  })

  it('names no one', () => {
    // It renders for an unauthenticated stranger who typed an address into a
    // box. Any identity here turns signin into a harvester.
    renderModal('2026-09-26')
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).not.toHaveTextContent(/keluarga adios/i)
    expect(dialog).not.toHaveTextContent(/@/)
  })

  it('dismisses on the button', async () => {
    const onDismiss = renderModal('2026-09-26')
    await userEvent.click(screen.getByRole('button', { name: /kembali/i }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('dismisses on Escape', async () => {
    const onDismiss = renderModal('2026-09-26')
    await userEvent.keyboard('{Escape}')
    expect(onDismiss).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/modules/auth/signin/HouseholdDeletionModal.test.tsx`
Expected: FAIL — the module does not exist.

- [ ] **Step 4: Write the modal**

Create `src/modules/auth/signin/HouseholdDeletionModal.tsx`:

```tsx
import { Dialog } from 'radix-ui'
import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { formatDate } from '@/utils/formatters'

interface Props {
  /** A date opens the modal; null keeps it shut. */
  deadline: string | null
  onDismiss: () => void
}

/**
 * The dead end at the far side of signin.
 *
 * Radix `Dialog` with `role="alertdialog"` rather than Radix `AlertDialog`:
 * `AlertDialog` suppresses outside-click dismissal by design, because it exists
 * to force a choice. There is no choice here — the visitor is being told
 * something — so the backdrop must dismiss, and `Dialog` is the primitive that
 * does that.
 *
 * The deadline and nothing else. No household name, no admin name or email:
 * this renders for an unauthenticated stranger who typed an address into a box,
 * and anything identifying would turn the signin form into a harvester.
 */
export const HouseholdDeletionModal = ({ deadline, onDismiss }: Props) => {
  const m = useMessages()
  const { locale } = useSettings()

  return (
    <Dialog.Root
      open={deadline !== null}
      onOpenChange={(open) => {
        if (!open) onDismiss()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[8px]" />
        <Dialog.Content
          role="alertdialog"
          className="bg-card lift-shadow fixed top-1/2 left-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 text-center"
          // Opened from a URL parameter or a failed request, so Radix has no
          // trigger to restore focus to. Without this, dismissing drops focus
          // to <body> and a keyboard user restarts from the top of the page.
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            document.getElementById('signin-email')?.focus()
          }}
        >
          <Dialog.Title className="font-display text-[15px] font-bold">
            {m.deletion_title()}
          </Dialog.Title>
          <Dialog.Description className="text-muted mt-2 text-[12px] leading-relaxed">
            {m.deletion_body({
              date: deadline ? formatDate(deadline, locale) : '',
            })}
          </Dialog.Description>

          <p className="bg-chip text-muted mt-3 rounded-lg px-3 py-2 text-[11px]">
            {m.deletion_note()}
          </p>

          <Dialog.Close asChild>
            <button
              type="button"
              className="border-hair text-ink mt-5 w-full rounded-lg border px-4 py-2 text-[12px] font-semibold"
            >
              {m.deletion_back()}
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

`useSettings().locale` is already a full BCP-47 tag — `SettingsContext` maps `lang` through `INTL_LOCALE` to `'id-ID'` / `'en-US'` — so it feeds `formatDate` directly with no further conversion.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/modules/auth/signin/HouseholdDeletionModal.test.tsx`
Expected: PASS, 5 cases.

- [ ] **Step 6: Wire both entry points into the card**

In `src/modules/auth/signin/SigninCard.tsx`:

Give the email input a stable id so the modal can return focus to it — replace `id={fieldId}` with `id="signin-email"` on the `<input>`, and `htmlFor={fieldId}` with `htmlFor="signin-email"` on the `<label>`. Keep `fieldId` for the `aria-describedby` error id.

Add the state, seeded from the landing:

```tsx
const [deletionDeadline, setDeletionDeadline] = useState<string | null>(
  landing?.reason === LandingReason.DELETION_PENDING
    ? (landing.until ?? null)
    : null,
)
```

In `send`, add the 403 branch:

```tsx
const send = (address: string) => {
  setFormatError(false)
  request.mutate(address, {
    onSuccess: () => setSendsUsed((used) => used + 1),
    onError: (error) => {
      const deadline = deletionDeadlineFromResponse(error)
      if (deadline) setDeletionDeadline(deadline)
    },
  })
}
```

Import `deletionDeadlineFromResponse` from `@/modules/auth/signin/signin`, `useNavigate` from `react-router-dom`, and the modal. Render it as the last child of both the sent branch and the form branch:

```tsx
<HouseholdDeletionModal
  deadline={deletionDeadline}
  onDismiss={() => {
    setDeletionDeadline(null)
    // Strip the query string, or a reload reopens the modal and the
    // dismiss reads as broken.
    if (landing?.reason === LandingReason.DELETION_PENDING) {
      navigate('/signin', { replace: true })
    }
  }}
/>
```

A 403 must not also render as an inline error, so exclude it from `error`:

```tsx
const error = formatError
  ? SigninError.FORMAT
  : request.error && !deletionDeadlineFromResponse(request.error)
    ? signinErrorFromResponse(request.error)
    : undefined
```

- [ ] **Step 7: Add the card-level test**

Append to `src/modules/auth/signin/SigninCard.test.tsx`:

```tsx
it('opens the deletion modal on a 403 instead of an inline error', async () => {
  renderWithProviders(<SigninCard landing={null} />)
  await submit('hapus@email.com')

  expect(await screen.findByRole('alertdialog')).toHaveTextContent(
    /rumah ini sedang dihapus/i,
  )
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('opens the deletion modal when the URL carries the grace deadline', () => {
  renderWithProviders(
    <SigninCard
      landing={{ reason: LandingReason.DELETION_PENDING, until: '2026-09-26' }}
    />,
  )
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
})

it('returns focus to the email field when the modal is dismissed', async () => {
  // Radix restores focus to the trigger, and this modal has none — it opens
  // from a URL parameter. Without onCloseAutoFocus, focus lands on <body>
  // and a keyboard user restarts from the top of the document.
  renderWithProviders(
    <SigninCard
      landing={{ reason: LandingReason.DELETION_PENDING, until: '2026-09-26' }}
    />,
  )

  await userEvent.click(screen.getByRole('button', { name: /kembali/i }))

  await waitFor(() => expect(screen.getByLabelText(/email/i)).toHaveFocus())
})
```

- [ ] **Step 8: Correct the `ConfirmDialog` comment**

In `src/components/ConfirmDialog.tsx`, replace the first line of the doc comment:

```
 * The dialog for a choice. Everything else opens in place — a dialog is
 * reserved for the one moment where the user must stop and answer.
 *
 * (The signin deletion modal is the other dialog in the product, and is not
 * this: it announces a dead end rather than asking anything.)
```

- [ ] **Step 9: Run the full suite**

Run: `npm run type-check && npm run lint && npm run test`
Expected: PASS, 12 card cases.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: household deletion modal on signin"
```

---

### Task 10: Sign out

**Files:**

- Create: `src/modules/auth/api/logout.ts`
- Modify: `src/components/Layout/Sidebar.tsx`
- Test: `src/components/Layout/Sidebar.test.tsx`
- Modify: `messages/en.json`, `messages/id.json`

**Interfaces:**

- Consumes: `apiClient` (Task 1), `useMe` (Task 4)
- Produces: `useLogout()` returning a TanStack mutation whose `mutate()` takes no argument.

- [ ] **Step 1: Add the copy**

Add `"act_signout": "Sign out"` to `messages/en.json` and `"act_signout": "Keluar"` to `messages/id.json`, in alphabetical position among the `act_*` keys.

- [ ] **Step 2: Write the failing test**

Create `src/components/Layout/Sidebar.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'
import { authHandlers } from '@/mocks/handlers/auth'
import { authState } from '@/mocks/db'
import { Sidebar } from '@/components/Layout/Sidebar'

describe('Sidebar', () => {
  beforeEach(() => {
    server.use(...authHandlers)
    authState.authenticated = true
  })

  it('shows who is signed in and which household', () => {
    renderWithProviders(<Sidebar />)
    expect(screen.getByText('Budi')).toBeInTheDocument()
    expect(screen.getByText('Keluarga Adios')).toBeInTheDocument()
  })

  it('signs out through the API', async () => {
    renderWithProviders(<Sidebar />)

    await userEvent.click(screen.getByRole('button', { name: /keluar/i }))

    await waitFor(() => expect(authState.authenticated).toBe(false))
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/components/Layout/Sidebar.test.tsx`
Expected: FAIL — there is no sign-out button.

- [ ] **Step 4: Write the hook**

Create `src/modules/auth/api/logout.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '@/api/client'

/**
 * End this session.
 *
 * `clear()` rather than invalidate: everything cached belongs to whoever was
 * signed in a moment ago, and on a shared device the next person must not see
 * a frame of it. The navigation lives here so every caller is just a button.
 */
export const useLogout = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout')
    },
    onSuccess: () => {
      queryClient.clear()
      navigate('/signin', { replace: true })
    },
  })
}
```

- [ ] **Step 5: Add the button**

In `src/components/Layout/Sidebar.tsx`, import `useLogout`, call it inside the component (`const logout = useLogout()`), and wrap the existing account `<Link>` and a new button in a container so both sit in the footer:

```tsx
<div className="border-hair mt-2 border-t">
  <Link
    to={settingsHref(SETTINGS_ANCHORS.household)}
    className="hover:bg-chip flex items-center gap-2.5 px-3 py-3"
  >
    {/* the existing avatar span and name/household block, unchanged */}
  </Link>

  <button
    type="button"
    onClick={() => logout.mutate()}
    disabled={logout.isPending}
    className="text-muted hover:text-ink w-full px-3 pb-3 text-left text-[11px] font-semibold disabled:opacity-60"
  >
    {m.act_signout()}
  </button>
</div>
```

The `<Link>` loses its own `border-hair mt-2 border-t` classes to the wrapper.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/Layout/Sidebar.test.tsx`
Expected: PASS, 2 cases.

- [ ] **Step 7: Run the full suite**

Run: `npm run type-check && npm run lint && npm run test && npm run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: sign out from the sidebar"
```

---

### Task 11: Manual verification against the real backend

MSW cannot prove the redirect-and-cookie loop: the emailed link is a top-level browser navigation to the API origin, which sets the session cookie and 302s back. No test in this repo exercises that.

**Files:** none — this task changes no code.

- [ ] **Step 1: Confirm the backend's CORS origin**

The app must be listed as `APP_URL` with `credentials: true`. If the frontend runs on `http://localhost:5173`, that exact origin must be what the backend allows. A mismatch shows up as a CORS error on `/auth/me`, not as a signin failure.

- [ ] **Step 2: Start the app against the real API**

```bash
cat .env    # VITE_API_URL=http://localhost:3073, VITE_MOCK_AUTH unset or false
npm run dev
```

- [ ] **Step 3: Walk the loop**

Visit `/signin` and confirm each of these:

1. Submitting an invited address shows "Cek emailmu" with the address named.
2. Submitting an uninvited address shows the inline "belum terdaftar" error **and stays on the form** — this is the interceptor fix from Task 2. If the page navigates away, the exemption list is wrong.
3. The emailed link lands on `/dashboard` signed in, with the sidebar showing the real name and household.
4. A full reload keeps the session — proves the cookie is being sent cross-origin.
5. Clicking the link a second time lands on `/signin?error=invalid_link` and renders the expired notice.
6. Sign out returns to `/signin`, and a reload does not restore the session.

- [ ] **Step 4: Record the result**

If every step passes, note it in the PR description. If a step fails, stop and report which one — do not patch around a backend mismatch in the frontend.

---

## Notes for the implementer

- **The plan's line numbers come from commit `a1a9cc5`.** This repo has been refactored twice recently, and files have moved between directories. If a cited line does not match, `npm run type-check` will name every real call site — trust it over the table.
- **`type-check` is the primary gate on the cascade tasks** (3, 5, 6). The tests will not catch a missed consumer; the compiler will.
- **Do not edit `src/paraglide/`.** It regenerates from `messages/*.json` on the next dev or build run.
- **Tasks 7 and 8 share a commit.** Task 7 deletes the stub that Task 8's card replaces, so the tree does not compile in between. Every other task ends green.
