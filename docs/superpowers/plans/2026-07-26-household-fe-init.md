# Household FE Initialization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the existing default Vite+React scaffold into the REVISED architecture — a tenant-aware app with TanStack Query server state, URL-based filters, Context session, and a working auth+expenses vertical slice on MSW mocks — plus Tailwind, Vitest, Capacitor, CI, and git hooks.

**Architecture:** Server state lives in TanStack Query (tenant-scoped query keys). Filters live in the URL (`useSearchParams`). Session lives in one Context fed by a `useSession` query. Local UI lives in `useState`. No Zustand, no `/stores`. Axios interceptors attach `X-Household-ID` (via a module-level setter, since interceptors can't call hooks) and redirect on 401. MSW intercepts `/api/*` in both the dev browser and the Vitest node environment.

**Tech Stack:** React 19, Vite 8, TypeScript 6 (strict), React Router 7, TanStack Query 5, React Hook Form 7, Axios, Tailwind v4 (`@tailwindcss/vite`), Vitest + Testing Library + MSW, Capacitor.

## Global Constraints

- **No Zustand, no `/stores` folder, no Redux.** (REVISED §4)
- **Runtime deps are exact-pinned** (`npm install --save-exact`). (REVISED §12)
- **State ownership:** server→TanStack Query, filters→URL params, session→Context, UI→useState. (REVISED §2)
- **Every expenses query key is scoped by `householdId`.** (REVISED §5)
- **TypeScript:** `strict: true`; `verbatimModuleSyntax: true` → all type-only imports MUST use `import type`; `erasableSyntaxOnly: true` → NO enums, namespaces, or constructor parameter-properties (use union types + plain objects); `noUnusedLocals`/`noUnusedParameters` → no unused symbols.
- **Path alias:** import app modules via `@/...` (maps to `src/`).
- **Import style:** app code imports from `@/...`; MSW handlers/paths use `/api/...` (relative, resolved against origin).
- **Commit** after every task with a `feat:`/`chore:`/`test:` message ending with the Co-Authored-By trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Work happens on branch `feat/project-init`.

## Canonical Type Reference (defined in Task 2 — every later task relies on these)

```ts
// @/types/household.ts
export type Role = 'admin' | 'member'
export interface User {
  id: string
  name: string
  email: string
  role: Role
  householdId: string
}
export interface Household {
  id: string
  name: string
}
export interface Session {
  user: User
  household: Household
}

// @/types/expense.ts
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

// @/types/api.ts
export interface ApiErrorBody {
  message: string
  statusCode?: number
}
```

---

## Task 1: Tooling & Config Foundation

**Files:**

- Modify: `package.json` (deps + scripts)
- Modify: `vite.config.ts`
- Modify: `tsconfig.app.json` (strict + paths)
- Create: `src/styles/globals.css`
- Modify: `src/main.tsx`
- Create: `.env.example`
- Delete: `src/App.css`, `src/index.css`, `src/assets/react.svg`, `src/assets/vite.svg` (demo cruft; keep `src/assets/hero.png`)
- Create: `src/App.tsx` (temporary smoke component — replaced in Task 6)
- Create: `src/smoke.test.ts` (temporary — deleted at end of task)

**Interfaces:**

- Produces: `@/*` path alias; Vitest configured (`globals: true`, jsdom); Tailwind v4 active; `src/styles/globals.css`; npm scripts `type-check`, `test`, `test:watch`, `test:coverage`.

- [ ] **Step 1: Install runtime deps (exact-pinned)**

Run:

```bash
npm install --save-exact @tanstack/react-query react-router-dom react-hook-form axios @capacitor/core
```

- [ ] **Step 2: Install dev deps**

Run:

```bash
npm install -D @tanstack/react-query-devtools tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitest/coverage-v8 msw @capacitor/cli @capacitor/ios @capacitor/android prettier prettier-plugin-tailwindcss husky lint-staged
```

- [ ] **Step 3: Rewrite `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
```

- [ ] **Step 4: Update `tsconfig.app.json`** — add `strict`, `baseUrl`, `paths`, and vitest globals to `types`.

In `compilerOptions`, add these keys (keep the existing keys):

```jsonc
"strict": true,
"baseUrl": ".",
"paths": { "@/*": ["src/*"] },
"types": ["vite/client", "vitest/globals"]
```

(The existing `"types": ["vite/client"]` line is replaced by the one above.)

- [ ] **Step 5: Create `src/styles/globals.css`**

```css
@import 'tailwindcss';

:root {
  color-scheme: light dark;
}

body {
  margin: 0;
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    sans-serif;
}
```

- [ ] **Step 6: Delete demo files**

Run:

```bash
rm -f src/App.css src/index.css src/assets/react.svg src/assets/vite.svg
```

- [ ] **Step 7: Write temporary `src/App.tsx` smoke component**

```tsx
export default function App() {
  return <h1 className="p-8 text-2xl font-bold">Household</h1>
}
```

- [ ] **Step 8: Rewrite `src/main.tsx` (plain — MSW bootstrap is added in Task 4)**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import '@/styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Note: the MSW dev-worker bootstrap is deliberately NOT added here. `vite build`
resolves dynamic-import specifiers while building the module graph, so importing
`@/mocks/browser` before it exists (Task 4) would fail Task 1's build. Task 4
rewrites this file once `browser.ts` exists.

- [ ] **Step 9: Create `.env.example`**

```bash
# API base URL for the NestJS backend. Leave unset in dev to use the MSW mock layer.
VITE_API_URL=/api
VITE_APP_NAME=Household
# Set to "false" to disable the MSW mock worker in dev.
VITE_ENABLE_MOCKS=true
```

- [ ] **Step 10: Add npm scripts** — merge into `package.json` `"scripts"`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "type-check": "tsc -b",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

- [ ] **Step 11: Write a temporary smoke test `src/smoke.test.ts`**

```ts
describe('tooling smoke test', () => {
  it('runs vitest with globals', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 12: Verify test harness runs**

Run: `npm run test`
Expected: PASS (1 test). Confirms Vitest + jsdom + globals config works.

- [ ] **Step 13: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds (Tailwind processes `globals.css`, `@` alias resolves), lint passes.

- [ ] **Step 14: Delete the smoke test and commit**

```bash
rm src/smoke.test.ts
git add -A
git commit -m "chore: set up tooling (Tailwind v4, Vitest, path alias, MSW bootstrap)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Shared Types & Utils

**Files:**

- Create: `src/types/household.ts`, `src/types/expense.ts`, `src/types/api.ts`, `src/types/index.ts`
- Create: `src/utils/formatters.ts`, `src/utils/permissions.ts`, `src/utils/validators.ts`, `src/utils/errors.ts`
- Test: `src/utils/formatters.test.ts`, `src/utils/permissions.test.ts`

**Interfaces:**

- Produces: all Canonical Types (see top of plan); `formatCurrency(value, currency?, locale?)`, `formatDate(iso)`, `canManageExpenses(role)`, `hasRole(role, required)`, `isNonEmpty(v)`, `isPositiveNumber(v)`, `getErrorMessage(error): string`.

- [ ] **Step 1: Create `src/types/household.ts`**

```ts
export type Role = 'admin' | 'member'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  householdId: string
}

export interface Household {
  id: string
  name: string
}

export interface Session {
  user: User
  household: Household
}
```

- [ ] **Step 2: Create `src/types/expense.ts`**

```ts
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
```

Note: `ExpenseFilters` lives here (shared) rather than in a module `filter.ts`, so the `@/api` query layer can consume it without importing from a feature module. This is a deliberate, minor deviation from spec §5.

- [ ] **Step 3: Create `src/types/api.ts`**

```ts
export interface ApiErrorBody {
  message: string
  statusCode?: number
}
```

- [ ] **Step 4: Create `src/types/index.ts`**

```ts
export type * from '@/types/household'
export type * from '@/types/expense'
export type * from '@/types/api'
```

- [ ] **Step 5: Write failing test `src/utils/formatters.test.ts`**

```ts
import { formatCurrency, formatDate } from '@/utils/formatters'

describe('formatCurrency', () => {
  it('formats an integer amount as a currency string', () => {
    const result = formatCurrency(150000)
    expect(typeof result).toBe('string')
    expect(result).toContain('150')
  })
})

describe('formatDate', () => {
  it('formats a YYYY-MM-DD string without timezone drift', () => {
    expect(formatDate('2026-01-15')).toBe('Jan 15, 2026')
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test -- formatters`
Expected: FAIL (cannot import `@/utils/formatters`).

- [ ] **Step 7: Implement `src/utils/formatters.ts`**

```ts
export const formatCurrency = (
  value: number,
  currency = 'IDR',
  locale = 'id-ID',
): string =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)

export const formatDate = (iso: string, locale = 'en-US'): string => {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  const date = new Date(year, (month ?? 1) - 1, day ?? 1)
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test -- formatters`
Expected: PASS.

- [ ] **Step 9: Write failing test `src/utils/permissions.test.ts`**

```ts
import { canManageExpenses, hasRole } from '@/utils/permissions'

describe('permissions', () => {
  it('lets admins manage expenses', () => {
    expect(canManageExpenses('admin')).toBe(true)
    expect(canManageExpenses('member')).toBe(false)
  })

  it('checks an exact role', () => {
    expect(hasRole('admin', 'admin')).toBe(true)
    expect(hasRole('member', 'admin')).toBe(false)
  })
})
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npm run test -- permissions`
Expected: FAIL (cannot import `@/utils/permissions`).

- [ ] **Step 11: Implement `src/utils/permissions.ts`**

```ts
import type { Role } from '@/types/household'

export const canManageExpenses = (role: Role): boolean => role === 'admin'

export const hasRole = (role: Role, required: Role): boolean =>
  role === required
```

- [ ] **Step 12: Implement `src/utils/validators.ts`**

```ts
export const isNonEmpty = (value: string): boolean => value.trim().length > 0

export const isPositiveNumber = (value: number): boolean =>
  Number.isFinite(value) && value > 0
```

- [ ] **Step 13: Implement `src/utils/errors.ts`**

```ts
import { AxiosError } from 'axios'
import type { ApiErrorBody } from '@/types/api'

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined
    return body?.message ?? error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Something went wrong'
}
```

- [ ] **Step 14: Run tests + type-check, then commit**

Run: `npm run test && npm run type-check`
Expected: PASS.

```bash
git add -A
git commit -m "feat: add shared types and utility helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: API Client & Query Client

**Files:**

- Create: `src/api/client.ts`, `src/api/queryClient.ts`, `src/api/types.ts`
- Test: `src/api/client.test.ts`

**Interfaces:**

- Consumes: nothing from prior tasks (pure axios setup).
- Produces: `apiClient` (AxiosInstance), `setHouseholdId(id: string): void`, `queryClient` (QueryClient). `src/api/types.ts` re-exports `Paginated`, `ApiErrorBody` for the API layer.

- [ ] **Step 1: Write failing test `src/api/client.test.ts`**

```ts
import { apiClient, setHouseholdId } from '@/api/client'

describe('apiClient', () => {
  it('is configured to send credentials', () => {
    expect(apiClient.defaults.withCredentials).toBe(true)
  })

  it('attaches X-Household-ID via the request interceptor after setHouseholdId', async () => {
    setHouseholdId('household-999')
    // Run the request interceptor manually against a minimal config.
    const handlers = apiClient.interceptors.request as unknown as {
      handlers: {
        fulfilled: (c: { headers: Headers }) => { headers: Headers }
      }[]
    }
    const fulfilled = handlers.handlers[0].fulfilled
    const config = { headers: new Headers() }
    const result = fulfilled(config)
    expect(result.headers.get('X-Household-ID')).toBe('household-999')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- client`
Expected: FAIL (cannot import `@/api/client`).

- [ ] **Step 3: Implement `src/api/client.ts`**

```ts
import axios from 'axios'

let currentHouseholdId = ''

/**
 * Feeds the household id to the axios request interceptor. Called from
 * HouseholdContext — interceptors cannot call React hooks, so the id is held in
 * module scope instead.
 */
export const setHouseholdId = (id: string): void => {
  currentHouseholdId = id
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
})

apiClient.interceptors.request.use((config) => {
  if (currentHouseholdId) {
    config.headers.set('X-Household-ID', currentHouseholdId)
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const status =
      typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined
    if (
      status === 401 &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/auth')
    ) {
      window.location.assign('/auth/login')
    }
    return Promise.reject(error)
  },
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- client`
Expected: PASS (both assertions).

- [ ] **Step 5: Implement `src/api/queryClient.ts`**

```ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
})
```

- [ ] **Step 6: Implement `src/api/types.ts`**

```ts
export type { Paginated, Pagination } from '@/types/expense'
export type { ApiErrorBody } from '@/types/api'
```

- [ ] **Step 7: Run tests + type-check, then commit**

Run: `npm run test && npm run type-check`
Expected: PASS.

```bash
git add -A
git commit -m "feat: add axios client with tenant interceptor and query client

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: MSW Mocks & Test Harness

**Files:**

- Create: `src/mocks/data.ts`, `src/mocks/handlers.ts`, `src/mocks/browser.ts`, `src/mocks/server.ts`
- Create: `src/test/setup.ts`, `src/test/test-utils.tsx`
- Create: `public/mockServiceWorker.js` (generated by `msw init`)
- Test: `src/mocks/handlers.test.ts`

**Interfaces:**

- Consumes: `apiClient` (Task 3), canonical types (Task 2).
- Produces: `handlers` (MSW array), `worker` (`@/mocks/browser`), `server` (`@/mocks/server`), `resetMockState()`, seed exports (`MOCK_USER`, `MOCK_HOUSEHOLD`, `MOCK_TYPES`, `MOCK_SOURCES`), and test helpers `createWrapper()` and `renderWithProviders(ui, options?)` with `TEST_HOUSEHOLD_VALUE`.

- [ ] **Step 1: Generate the MSW service worker**

Run: `npx msw init public/ --save`
Expected: creates `public/mockServiceWorker.js` and records the worker directory in `package.json`.

- [ ] **Step 2: Create `src/mocks/data.ts`**

```ts
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
```

- [ ] **Step 3: Create `src/mocks/handlers.ts`**

```ts
import { http, HttpResponse } from 'msw'
import type { CreateExpenseInput, Expense } from '@/types/expense'
import {
  MOCK_HOUSEHOLD,
  MOCK_SOURCES,
  MOCK_TYPES,
  MOCK_USER,
  authState,
  db,
  nextExpenseId,
} from '@/mocks/data'

const paginate = (items: Expense[], page: number, limit: number) => {
  const start = (page - 1) * limit
  return {
    items: items.slice(start, start + limit),
    pagination: {
      total: items.length,
      page,
      pages: Math.max(1, Math.ceil(items.length / limit)),
    },
  }
}

export const handlers = [
  http.post('/api/auth/login', async () => {
    authState.authenticated = true
    return HttpResponse.json({ user: MOCK_USER, household: MOCK_HOUSEHOLD })
  }),

  http.post('/api/auth/logout', () => {
    authState.authenticated = false
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/auth/session', () => {
    if (!authState.authenticated) {
      return new HttpResponse(null, { status: 401 })
    }
    return HttpResponse.json({ user: MOCK_USER, household: MOCK_HOUSEHOLD })
  }),

  http.get('/api/expenses', ({ request }) => {
    const url = new URL(request.url)
    const typeId = url.searchParams.get('typeId')
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '25')

    let items = [...db.expenses]
    if (typeId) {
      items = items.filter((expense) => expense.typeId === typeId)
    }
    return HttpResponse.json(paginate(items, page, limit))
  }),

  http.post('/api/expenses', async ({ request }) => {
    const input = (await request.json()) as CreateExpenseInput
    const created: Expense = {
      id: nextExpenseId(),
      householdId: MOCK_HOUSEHOLD.id,
      ...input,
    }
    db.expenses.unshift(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.put('/api/expenses/:id', async ({ params, request }) => {
    const patch = (await request.json()) as Partial<Expense>
    const index = db.expenses.findIndex((expense) => expense.id === params.id)
    if (index === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    db.expenses[index] = { ...db.expenses[index], ...patch }
    return HttpResponse.json(db.expenses[index])
  }),

  http.delete('/api/expenses/:id', ({ params }) => {
    db.expenses = db.expenses.filter((expense) => expense.id !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/expense-types', () => HttpResponse.json(MOCK_TYPES)),

  http.get('/api/payment-sources', () => HttpResponse.json(MOCK_SOURCES)),

  http.get('/api/users', () => HttpResponse.json([MOCK_USER])),
]
```

Note: all mutable state lives on the `db` object (and `authState`) rather than
on reassignable `let` exports — ES module import bindings are read-only, so the
delete handler mutates `db.expenses` (a property) instead of reassigning an
import. `resetMockState()` (called in `afterEach`) restores `db.expenses` to a
fresh seed between tests.

- [ ] **Step 4: Create `src/mocks/browser.ts`**

```ts
import { setupWorker } from 'msw/browser'
import { handlers } from '@/mocks/handlers'

export const worker = setupWorker(...handlers)
```

- [ ] **Step 5: Create `src/mocks/server.ts`**

```ts
import { setupServer } from 'msw/node'
import { handlers } from '@/mocks/handlers'

export const server = setupServer(...handlers)
```

- [ ] **Step 6: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '@/mocks/server'
import { resetMockState } from '@/mocks/data'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockState()
})
afterAll(() => server.close())
```

- [ ] **Step 7: Create `src/test/test-utils.tsx`**

```tsx
import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HouseholdContext } from '@/contexts/HouseholdContext'
import type { HouseholdContextValue } from '@/contexts/HouseholdContext'
import { MOCK_HOUSEHOLD, MOCK_USER } from '@/mocks/data'

export const createTestQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })

/** Wrapper for renderHook — QueryClient + Router, no household context. */
export const createWrapper = () => {
  const client = createTestQueryClient()
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

export const TEST_HOUSEHOLD_VALUE: HouseholdContextValue = {
  user: MOCK_USER,
  household: MOCK_HOUSEHOLD,
  householdId: MOCK_HOUSEHOLD.id,
  role: 'admin',
  isAuthenticated: true,
  isLoading: false,
}

interface RenderOptions {
  household?: Partial<HouseholdContextValue>
  initialEntries?: string[]
}

/** Render a component with QueryClient + Router + a fixed household context. */
export const renderWithProviders = (
  ui: ReactElement,
  options: RenderOptions = {},
) => {
  const client = createTestQueryClient()
  const householdValue: HouseholdContextValue = {
    ...TEST_HOUSEHOLD_VALUE,
    ...options.household,
  }
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={options.initialEntries ?? ['/']}>
        <HouseholdContext.Provider value={householdValue}>
          {ui}
        </HouseholdContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
```

Note: `test-utils` imports `HouseholdContext`/`HouseholdContextValue` from Task 5. Write Task 5 before running any test that imports `test-utils`. Task 4's own test (Step 8) does not import `test-utils`, so it runs independently.

- [ ] **Step 8: Rewrite `src/main.tsx` to start the MSW worker in dev**

Now that `@/mocks/browser` exists, replace `src/main.tsx` (from Task 1) with:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import '@/styles/globals.css'

async function enableMocking() {
  if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS === 'false') {
    return
  }
  const { worker } = await import('@/mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
```

The guard means production builds (`import.meta.env.DEV === false`) never start
the worker; the app then talks to the real `VITE_API_URL`.

- [ ] **Step 9: Write test `src/mocks/handlers.test.ts`**

```ts
import { server } from '@/mocks/server'
import { http, HttpResponse } from 'msw'
import { apiClient } from '@/api/client'
import type { Expense, Paginated } from '@/types/expense'

describe('MSW expense handlers', () => {
  it('returns seeded expenses through apiClient', async () => {
    const res = await apiClient.get<Paginated<Expense>>('/expenses')
    expect(res.data.items.length).toBeGreaterThan(0)
    expect(res.data.items[0].householdId).toBe('household-001')
  })

  it('supports one-off handler overrides for error cases', async () => {
    server.use(
      http.get('/api/expenses', () =>
        HttpResponse.json({ message: 'Server error' }, { status: 500 }),
      ),
    )
    await expect(apiClient.get('/expenses')).rejects.toMatchObject({
      response: { status: 500 },
    })
  })
})
```

- [ ] **Step 10: Run the handlers test**

Run: `npm run test -- handlers`
Expected: PASS (both). Confirms MSW node server + apiClient + setup lifecycle work together.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add MSW mock backend and Vitest test harness

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Session Query & Household Context

**Files:**

- Create: `src/api/queries/session.ts`
- Create: `src/contexts/HouseholdContext.tsx`, `src/contexts/useHousehold.ts`
- Test: `src/contexts/HouseholdContext.test.tsx`

**Interfaces:**

- Consumes: `apiClient` (T3), `setHouseholdId` (T3), `Session`/`User`/`Household`/`Role` (T2), MSW auth handlers (T4).
- Produces: `SESSION_KEY` (`readonly ['auth','session']`), `useSession()`; `HouseholdContext` (React context), `HouseholdContextValue` (interface), `HouseholdProvider` component; `useHousehold(): HouseholdContextValue`.

- [ ] **Step 1: Create `src/api/queries/session.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { Session } from '@/types/household'

export const SESSION_KEY = ['auth', 'session'] as const

export const useSession = () =>
  useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      const res = await apiClient.get<Session>('/auth/session')
      return res.data
    },
    staleTime: Infinity,
    retry: false,
  })
```

- [ ] **Step 2: Create `src/contexts/HouseholdContext.tsx`**

```tsx
import { createContext, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useSession } from '@/api/queries/session'
import { setHouseholdId } from '@/api/client'
import type { Household, Role, User } from '@/types/household'

export interface HouseholdContextValue {
  user: User | null
  household: Household | null
  householdId: string
  role: Role
  isAuthenticated: boolean
  isLoading: boolean
}

export const HouseholdContext = createContext<
  HouseholdContextValue | undefined
>(undefined)

export const HouseholdProvider = ({ children }: { children: ReactNode }) => {
  const { data: session, isLoading } = useSession()
  const householdId = session?.household?.id ?? ''

  useEffect(() => {
    setHouseholdId(householdId)
  }, [householdId])

  const value: HouseholdContextValue = {
    user: session?.user ?? null,
    household: session?.household ?? null,
    householdId,
    role: session?.user?.role ?? 'member',
    isAuthenticated: Boolean(session?.user),
    isLoading,
  }

  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  )
}
```

- [ ] **Step 3: Create `src/contexts/useHousehold.ts`**

```ts
import { useContext } from 'react'
import { HouseholdContext } from '@/contexts/HouseholdContext'
import type { HouseholdContextValue } from '@/contexts/HouseholdContext'

export const useHousehold = (): HouseholdContextValue => {
  const context = useContext(HouseholdContext)
  if (!context) {
    throw new Error('useHousehold must be used within HouseholdProvider')
  }
  return context
}
```

- [ ] **Step 4: Write failing test `src/contexts/HouseholdContext.test.tsx`**

```tsx
import { render, screen, waitFor, act } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HouseholdProvider } from '@/contexts/HouseholdContext'
import { useHousehold } from '@/contexts/useHousehold'
import { createTestQueryClient } from '@/test/test-utils'
import { apiClient } from '@/api/client'

function Probe() {
  const { isAuthenticated, householdId, isLoading } = useHousehold()
  if (isLoading) return <span>loading</span>
  return <span>{isAuthenticated ? `auth:${householdId}` : 'anon'}</span>
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
  it('exposes an anonymous session when not logged in', async () => {
    renderProvider()
    await waitFor(() => expect(screen.getByText('anon')).toBeInTheDocument())
  })

  it('exposes the household once a session exists', async () => {
    await act(async () => {
      await apiClient.post('/auth/login', {
        email: 'alex@example.com',
        password: 'x',
      })
    })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByText('auth:household-001')).toBeInTheDocument(),
    )
  })
})
```

- [ ] **Step 5: Run test to verify it fails, then passes**

Run: `npm run test -- HouseholdContext`
Expected: after Steps 1-3 exist, PASS (both). If run before implementation, FAIL on import.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add session query and household context

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Shared UI, Routing Skeleton, Guards & App Composition

**Files:**

- Create: `src/components/Loading.tsx`, `src/components/ErrorBoundary.tsx`, `src/components/PermissionGuard.tsx`, `src/components/Navbar.tsx`
- Create: `src/components/Layout/AuthLayout.tsx`, `src/components/Layout/DashboardLayout.tsx`
- Create: `src/pages/DashboardPage.tsx`, `src/pages/NotFoundPage.tsx`, `src/pages/ErrorPage.tsx`
- Create: `src/routes/ProtectedRoute.tsx`, `src/routes/PermissionRoute.tsx`, `src/routes/index.tsx`
- Create: `src/modules/auth/pages/LoginPage.tsx` (temporary placeholder — replaced in Task 7)
- Create: `src/modules/financial/pages/ExpensesPage.tsx` (temporary placeholder — replaced in Task 9)
- Modify: `src/App.tsx` (final composition, replaces Task 1 smoke version)
- Test: `src/routes/ProtectedRoute.test.tsx`

**Interfaces:**

- Consumes: `useHousehold` (T5), `HouseholdProvider` (T5), `queryClient` (T3).
- Produces: `Loading`, `ErrorBoundary`, `PermissionGuard`, `Navbar`, `AuthLayout`, `DashboardLayout`, `DashboardPage`, `NotFoundPage`, `ErrorPage`, `ProtectedRoute`, `PermissionRoute`, `router`, default `App`. Named exports `LoginPage` and `ExpensesPage` (placeholders that Tasks 7/9 replace with the same names).

- [ ] **Step 1: Create `src/components/Loading.tsx`**

```tsx
export const Loading = () => (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-40 items-center justify-center p-8 text-sm text-gray-500"
  >
    Loading…
  </div>
)
```

- [ ] **Step 2: Create `src/components/ErrorBoundary.tsx`**

```tsx
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="p-8 text-center text-red-600">
            Something went wrong.
          </div>
        )
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 3: Create `src/components/PermissionGuard.tsx`**

```tsx
import type { ReactNode } from 'react'
import { useHousehold } from '@/contexts/useHousehold'
import type { Role } from '@/types/household'

interface Props {
  requiredRole: Role
  children: ReactNode
  fallback?: ReactNode
}

export const PermissionGuard = ({
  requiredRole,
  children,
  fallback = null,
}: Props) => {
  const { role } = useHousehold()
  if (role !== requiredRole) {
    return <>{fallback}</>
  }
  return <>{children}</>
}
```

- [ ] **Step 4: Create `src/components/Navbar.tsx`**

```tsx
import { NavLink } from 'react-router-dom'
import { useHousehold } from '@/contexts/useHousehold'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 text-sm font-medium ${
    isActive ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
  }`

export const Navbar = () => {
  const { household } = useHousehold()
  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
        <span className="mr-4 font-semibold">
          {household?.name ?? 'Household'}
        </span>
        <NavLink to="/dashboard" className={linkClass}>
          Dashboard
        </NavLink>
        <NavLink to="/financial/expenses" className={linkClass}>
          Expenses
        </NavLink>
      </nav>
    </header>
  )
}
```

- [ ] **Step 5: Create `src/components/Layout/DashboardLayout.tsx`**

```tsx
import { Outlet } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'

export const DashboardLayout = () => (
  <div className="min-h-screen bg-gray-50">
    <Navbar />
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Outlet />
    </main>
  </div>
)
```

- [ ] **Step 6: Create `src/components/Layout/AuthLayout.tsx`**

```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useHousehold } from '@/contexts/useHousehold'
import { Loading } from '@/components/Loading'

export const AuthLayout = () => {
  const { isAuthenticated, isLoading } = useHousehold()
  if (isLoading) return <Loading />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <Outlet />
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create `src/pages/DashboardPage.tsx`, `NotFoundPage.tsx`, `ErrorPage.tsx`**

`src/pages/DashboardPage.tsx`:

```tsx
import { useHousehold } from '@/contexts/useHousehold'

export const DashboardPage = () => {
  const { user } = useHousehold()
  return (
    <section>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Welcome back, {user?.name ?? 'there'}.
      </p>
    </section>
  )
}
```

`src/pages/NotFoundPage.tsx`:

```tsx
import { Link } from 'react-router-dom'

export const NotFoundPage = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-3">
    <h1 className="text-3xl font-bold">404</h1>
    <p className="text-gray-600">Page not found.</p>
    <Link to="/dashboard" className="text-blue-600 underline">
      Go to dashboard
    </Link>
  </div>
)
```

`src/pages/ErrorPage.tsx`:

```tsx
import { useRouteError } from 'react-router-dom'
import { getErrorMessage } from '@/utils/errors'

export const ErrorPage = () => {
  const error = useRouteError()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-gray-600">{getErrorMessage(error)}</p>
    </div>
  )
}
```

- [ ] **Step 8: Create `src/routes/ProtectedRoute.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useHousehold } from '@/contexts/useHousehold'
import { Loading } from '@/components/Loading'

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useHousehold()
  if (isLoading) return <Loading />
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />
  return <>{children}</>
}
```

- [ ] **Step 9: Create `src/routes/PermissionRoute.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useHousehold } from '@/contexts/useHousehold'
import type { Role } from '@/types/household'

interface Props {
  requiredRole: Role
  children: ReactNode
}

export const PermissionRoute = ({ requiredRole, children }: Props) => {
  const { role } = useHousehold()
  if (role !== requiredRole) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}
```

- [ ] **Step 10: Create temporary placeholder pages**

`src/modules/auth/pages/LoginPage.tsx`:

```tsx
export const LoginPage = () => <h1 className="text-xl font-bold">Login</h1>
```

`src/modules/financial/pages/ExpensesPage.tsx`:

```tsx
export const ExpensesPage = () => (
  <h1 className="text-xl font-bold">Expenses</h1>
)
```

- [ ] **Step 11: Create `src/routes/index.tsx`**

```tsx
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthLayout } from '@/components/Layout/AuthLayout'
import { DashboardLayout } from '@/components/Layout/DashboardLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { LoginPage } from '@/modules/auth/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ErrorPage } from '@/pages/ErrorPage'
import { Loading } from '@/components/Loading'

const ExpensesPage = lazy(() =>
  import('@/modules/financial/pages/ExpensesPage').then((module) => ({
    default: module.ExpensesPage,
  })),
)

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    errorElement: <ErrorPage />,
    children: [{ path: '/auth/login', element: <LoginPage /> }],
  },
  {
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard', element: <DashboardPage /> },
      {
        path: '/financial/expenses',
        element: (
          <Suspense fallback={<Loading />}>
            <ExpensesPage />
          </Suspense>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
```

- [ ] **Step 12: Rewrite `src/App.tsx` (final composition)**

```tsx
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { RouterProvider } from 'react-router-dom'
import { queryClient } from '@/api/queryClient'
import { HouseholdProvider } from '@/contexts/HouseholdContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { router } from '@/routes'

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HouseholdProvider>
          <RouterProvider router={router} />
        </HouseholdProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
```

- [ ] **Step 13: Write test `src/routes/ProtectedRoute.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { HouseholdContext } from '@/contexts/HouseholdContext'
import type { HouseholdContextValue } from '@/contexts/HouseholdContext'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { TEST_HOUSEHOLD_VALUE } from '@/test/test-utils'

const renderAt = (value: HouseholdContextValue) =>
  render(
    <HouseholdContext.Provider value={value}>
      <MemoryRouter initialEntries={['/secret']}>
        <Routes>
          <Route
            path="/secret"
            element={
              <ProtectedRoute>
                <div>secret content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/auth/login" element={<div>login screen</div>} />
        </Routes>
      </MemoryRouter>
    </HouseholdContext.Provider>,
  )

describe('ProtectedRoute', () => {
  it('renders children when authenticated', () => {
    renderAt(TEST_HOUSEHOLD_VALUE)
    expect(screen.getByText('secret content')).toBeInTheDocument()
  })

  it('redirects to login when unauthenticated', () => {
    renderAt({ ...TEST_HOUSEHOLD_VALUE, isAuthenticated: false, user: null })
    expect(screen.getByText('login screen')).toBeInTheDocument()
  })
})
```

- [ ] **Step 14: Run tests, type-check, lint, build**

Run: `npm run test && npm run type-check && npm run lint && npm run build`
Expected: all PASS (the full app now compiles and bundles; lazy chunk for expenses is emitted).

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "feat: add routing skeleton, guards, layouts, and app composition

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Auth Vertical Slice

**Files:**

- Create: `src/modules/auth/types/auth.ts`
- Create: `src/modules/auth/api/useLogin.ts`, `src/modules/auth/api/useLogout.ts`
- Create: `src/modules/auth/components/LoginForm.tsx`
- Replace: `src/modules/auth/pages/LoginPage.tsx` (was placeholder in Task 6)
- Test: `src/modules/auth/components/LoginForm.test.tsx`

**Interfaces:**

- Consumes: `apiClient` (T3), `SESSION_KEY` (T5), `useHousehold` (T5), MSW auth handlers (T4), `renderWithProviders` (T4).
- Produces: `LoginInput` (`{ email: string; password: string }`), `useLogin()`, `useLogout()`, `LoginForm` (props `{ onSuccess?: () => void }`), `LoginPage` (named export — same name the router imports).

- [ ] **Step 1: Create `src/modules/auth/types/auth.ts`**

```ts
export interface LoginInput {
  email: string
  password: string
}
```

- [ ] **Step 2: Create `src/modules/auth/api/useLogin.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { SESSION_KEY } from '@/api/queries/session'
import type { Session } from '@/types/household'
import type { LoginInput } from '@/modules/auth/types/auth'

export const useLogin = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const res = await apiClient.post<Session>('/auth/login', input)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_KEY })
    },
  })
}
```

- [ ] **Step 3: Create `src/modules/auth/api/useLogout.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { SESSION_KEY } from '@/api/queries/session'

export const useLogout = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_KEY })
    },
  })
}
```

- [ ] **Step 4: Create `src/modules/auth/components/LoginForm.tsx`**

```tsx
import { useForm } from 'react-hook-form'
import { useLogin } from '@/modules/auth/api/useLogin'
import { getErrorMessage } from '@/utils/errors'
import type { LoginInput } from '@/modules/auth/types/auth'

interface Props {
  onSuccess?: () => void
}

export const LoginForm = ({ onSuccess }: Props) => {
  const { mutate: login, isPending, error } = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = (data: LoginInput) => {
    login(data, { onSuccess: () => onSuccess?.() })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Sign in</h1>

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('email', { required: 'Email is required' })}
        />
        {errors.email && (
          <span role="alert" className="text-xs text-red-600">
            {errors.email.message}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('password', { required: 'Password is required' })}
        />
        {errors.password && (
          <span role="alert" className="text-xs text-red-600">
            {errors.password.message}
          </span>
        )}
      </label>

      {error && (
        <p role="alert" className="text-xs text-red-600">
          {getErrorMessage(error)}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
```

- [ ] **Step 5: Replace `src/modules/auth/pages/LoginPage.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'
import { LoginForm } from '@/modules/auth/components/LoginForm'

export const LoginPage = () => {
  const navigate = useNavigate()
  return (
    <LoginForm onSuccess={() => navigate('/dashboard', { replace: true })} />
  )
}
```

- [ ] **Step 6: Write failing test `src/modules/auth/components/LoginForm.test.tsx`**

```tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { LoginForm } from '@/modules/auth/components/LoginForm'

describe('LoginForm', () => {
  it('validates required fields before submitting', async () => {
    const onSuccess = vi.fn()
    renderWithProviders(<LoginForm onSuccess={onSuccess} />)

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('submits credentials and calls onSuccess', async () => {
    const onSuccess = vi.fn()
    renderWithProviders(<LoginForm onSuccess={onSuccess} />)

    await userEvent.type(screen.getByLabelText(/email/i), 'alex@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })
})
```

- [ ] **Step 7: Run test to verify it fails, then implement is already in place — run to pass**

Run: `npm run test -- LoginForm`
Expected: PASS (both). (Steps 1-5 provide the implementation; if TDD-ordering strictly, write Step 6 first, watch it fail on import, then add Steps 4-5.)

- [ ] **Step 8: Type-check, lint, commit**

Run: `npm run type-check && npm run lint`
Expected: PASS.

```bash
git add -A
git commit -m "feat: add auth vertical slice (login form + mutations)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Expenses Data Hooks (Queries & Mutations)

**Files:**

- Create: `src/api/queries/expenses.ts`, `src/api/queries/expenseTypes.ts`, `src/api/queries/paymentSources.ts`, `src/api/queries/users.ts`
- Create: `src/api/mutations/useCreateExpense.ts`, `src/api/mutations/useUpdateExpense.ts`, `src/api/mutations/useDeleteExpense.ts`
- Test: `src/api/queries/expenses.test.tsx`

**Interfaces:**

- Consumes: `apiClient` (T3), canonical expense types (T2), MSW expense handlers (T4), `createWrapper` (T4).
- Produces:
  - `EXPENSE_KEYS` with `.all`, `.byHousehold(householdId)`, `.list(householdId, filters?)`, `.detail(householdId, id)`.
  - `useExpenses(householdId, filters?)` → `UseQueryResult<Paginated<Expense>>`.
  - `useExpense(householdId, id)` → single `Expense`.
  - `useExpenseTypes(householdId)` → `ExpenseType[]`; `usePaymentSources(householdId)` → `PaymentSource[]`; `useUsers(householdId)` → `User[]`.
  - `useCreateExpense(householdId)`, `useUpdateExpense(householdId)`, `useDeleteExpense(householdId)` mutations.

- [ ] **Step 1: Create `src/api/queries/expenses.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { Expense, ExpenseFilters, Paginated } from '@/types/expense'

export const EXPENSE_KEYS = {
  all: ['expenses'] as const,
  byHousehold: (householdId: string) =>
    [...EXPENSE_KEYS.all, householdId] as const,
  list: (householdId: string, filters?: ExpenseFilters) =>
    [...EXPENSE_KEYS.byHousehold(householdId), 'list', filters ?? {}] as const,
  detail: (householdId: string, id: string) =>
    [...EXPENSE_KEYS.byHousehold(householdId), 'detail', id] as const,
}

export const useExpenses = (householdId: string, filters?: ExpenseFilters) =>
  useQuery({
    queryKey: EXPENSE_KEYS.list(householdId, filters),
    queryFn: async () => {
      const res = await apiClient.get<Paginated<Expense>>('/expenses', {
        params: filters,
      })
      return res.data
    },
    enabled: Boolean(householdId),
  })

export const useExpense = (householdId: string, id: string) =>
  useQuery({
    queryKey: EXPENSE_KEYS.detail(householdId, id),
    queryFn: async () => {
      const res = await apiClient.get<Expense>(`/expenses/${id}`)
      return res.data
    },
    enabled: Boolean(householdId && id),
  })
```

- [ ] **Step 2: Create `src/api/queries/expenseTypes.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { ExpenseType } from '@/types/expense'

export const EXPENSE_TYPE_KEYS = {
  all: (householdId: string) => ['expense-types', householdId] as const,
}

export const useExpenseTypes = (householdId: string) =>
  useQuery({
    queryKey: EXPENSE_TYPE_KEYS.all(householdId),
    queryFn: async () => {
      const res = await apiClient.get<ExpenseType[]>('/expense-types')
      return res.data
    },
    enabled: Boolean(householdId),
    staleTime: Infinity,
  })
```

- [ ] **Step 3: Create `src/api/queries/paymentSources.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { PaymentSource } from '@/types/expense'

export const PAYMENT_SOURCE_KEYS = {
  all: (householdId: string) => ['payment-sources', householdId] as const,
}

export const usePaymentSources = (householdId: string) =>
  useQuery({
    queryKey: PAYMENT_SOURCE_KEYS.all(householdId),
    queryFn: async () => {
      const res = await apiClient.get<PaymentSource[]>('/payment-sources')
      return res.data
    },
    enabled: Boolean(householdId),
    staleTime: Infinity,
  })
```

- [ ] **Step 4: Create `src/api/queries/users.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { User } from '@/types/household'

export const USER_KEYS = {
  all: (householdId: string) => ['users', householdId] as const,
}

export const useUsers = (householdId: string) =>
  useQuery({
    queryKey: USER_KEYS.all(householdId),
    queryFn: async () => {
      const res = await apiClient.get<User[]>('/users')
      return res.data
    },
    enabled: Boolean(householdId),
  })
```

- [ ] **Step 5: Create `src/api/mutations/useCreateExpense.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { EXPENSE_KEYS } from '@/api/queries/expenses'
import type { CreateExpenseInput, Expense, Paginated } from '@/types/expense'

export const useCreateExpense = (householdId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      const res = await apiClient.post<Expense>('/expenses', input)
      return res.data
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: EXPENSE_KEYS.byHousehold(householdId),
      })
      const previous = queryClient.getQueriesData<Paginated<Expense>>({
        queryKey: EXPENSE_KEYS.byHousehold(householdId),
      })
      const optimistic: Expense = {
        id: `optimistic-${input.name}-${input.datePaid}`,
        householdId,
        ...input,
      }
      queryClient.setQueriesData<Paginated<Expense>>(
        { queryKey: EXPENSE_KEYS.byHousehold(householdId) },
        (old) =>
          old
            ? {
                ...old,
                items: [optimistic, ...old.items],
                pagination: {
                  ...old.pagination,
                  total: old.pagination.total + 1,
                },
              }
            : old,
      )
      return { previous }
    },
    onError: (_error, _input, context) => {
      context?.previous?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: EXPENSE_KEYS.byHousehold(householdId),
      })
    },
  })
}
```

- [ ] **Step 6: Create `src/api/mutations/useUpdateExpense.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { EXPENSE_KEYS } from '@/api/queries/expenses'
import type { Expense } from '@/types/expense'

interface UpdateExpenseArgs {
  id: string
  patch: Partial<Expense>
}

export const useUpdateExpense = (householdId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: UpdateExpenseArgs) => {
      const res = await apiClient.put<Expense>(`/expenses/${id}`, patch)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: EXPENSE_KEYS.byHousehold(householdId),
      })
    },
  })
}
```

- [ ] **Step 7: Create `src/api/mutations/useDeleteExpense.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { EXPENSE_KEYS } from '@/api/queries/expenses'

export const useDeleteExpense = (householdId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/expenses/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: EXPENSE_KEYS.byHousehold(householdId),
      })
    },
  })
}
```

- [ ] **Step 8: Write test `src/api/queries/expenses.test.tsx`**

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { createWrapper } from '@/test/test-utils'
import { useExpenses } from '@/api/queries/expenses'

describe('useExpenses', () => {
  it('fetches the seeded expenses for a household', async () => {
    const { result } = renderHook(
      () =>
        useExpenses('household-001', {
          page: 1,
          limit: 25,
          sortBy: 'datePaid',
          sortOrder: 'desc',
        }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.items.length).toBeGreaterThan(0)
    expect(result.current.data?.items[0].householdId).toBe('household-001')
  })

  it('is disabled when householdId is empty', () => {
    const { result } = renderHook(() => useExpenses(''), {
      wrapper: createWrapper(),
    })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('surfaces server errors', async () => {
    server.use(
      http.get('/api/expenses', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    const { result } = renderHook(() => useExpenses('household-001'), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
```

- [ ] **Step 9: Run tests + type-check**

Run: `npm run test -- expenses && npm run type-check`
Expected: PASS (all three test cases).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add expense queries and mutations with tenant-scoped keys

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Expenses UI & URL Filters

**Files:**

- Create: `src/modules/financial/hooks/useExpenseFilters.ts`
- Create: `src/modules/financial/components/ExpenseTable.tsx`, `ExpenseFilter.tsx`, `ExpenseForm.tsx`
- Replace: `src/modules/financial/pages/ExpensesPage.tsx` (was placeholder in Task 6)
- Test: `src/modules/financial/hooks/useExpenseFilters.test.tsx`, `src/modules/financial/components/ExpenseForm.test.tsx`

**Interfaces:**

- Consumes: `useExpenses` (T8), `useCreateExpense` (T8), `useExpenseTypes`/`usePaymentSources`/`useUsers` (T8), `useHousehold` (T5), `formatCurrency`/`formatDate` (T2), `renderWithProviders` (T4).
- Produces: `useExpenseFilters(householdId)` → `{ filters, updateFilters, clearFilters, data, isLoading, isError, ... }`; `ExpenseTable`, `ExpenseFilter`, `ExpenseForm` (props `{ onSuccess?: () => void }`), `ExpensesPage`.

- [ ] **Step 1: Create `src/modules/financial/hooks/useExpenseFilters.ts`**

```ts
import { useSearchParams } from 'react-router-dom'
import { useExpenses } from '@/api/queries/expenses'
import type { ExpenseFilters } from '@/types/expense'

const PARAM_MAP: Record<keyof ExpenseFilters, string> = {
  dateFrom: 'dateFrom',
  dateTo: 'dateTo',
  typeId: 'type',
  sourceId: 'source',
  page: 'page',
  limit: 'limit',
  sortBy: 'sortBy',
  sortOrder: 'order',
}

const parseFilters = (params: URLSearchParams): ExpenseFilters => ({
  dateFrom: params.get('dateFrom') ?? undefined,
  dateTo: params.get('dateTo') ?? undefined,
  typeId: params.get('type') ?? undefined,
  sourceId: params.get('source') ?? undefined,
  page: Number(params.get('page') ?? '1'),
  limit: Number(params.get('limit') ?? '25'),
  sortBy: params.get('sortBy') ?? 'datePaid',
  sortOrder: (params.get('order') as 'asc' | 'desc' | null) ?? 'desc',
})

export const useExpenseFilters = (householdId: string) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = parseFilters(searchParams)
  const query = useExpenses(householdId, filters)

  const updateFilters = (next: Partial<ExpenseFilters>) => {
    const merged: ExpenseFilters = { ...filters, ...next }
    const params = new URLSearchParams()
    ;(Object.keys(PARAM_MAP) as (keyof ExpenseFilters)[]).forEach((key) => {
      const value = merged[key]
      if (value !== undefined && value !== '' && value !== null) {
        params.set(PARAM_MAP[key], String(value))
      }
    })
    setSearchParams(params)
  }

  const clearFilters = () => setSearchParams(new URLSearchParams())

  return { filters, updateFilters, clearFilters, ...query }
}
```

- [ ] **Step 2: Create `src/modules/financial/components/ExpenseTable.tsx`**

```tsx
import { formatCurrency, formatDate } from '@/utils/formatters'
import type { Expense } from '@/types/expense'

interface Props {
  expenses: Expense[]
  isLoading?: boolean
}

export const ExpenseTable = ({ expenses, isLoading }: Props) => {
  if (isLoading) {
    return <p className="py-6 text-sm text-gray-500">Loading expenses…</p>
  }
  if (expenses.length === 0) {
    return <p className="py-6 text-sm text-gray-500">No expenses yet.</p>
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-left text-gray-500">
          <th className="py-2">Name</th>
          <th className="py-2">Amount</th>
          <th className="py-2">Date</th>
        </tr>
      </thead>
      <tbody>
        {expenses.map((expense) => (
          <tr key={expense.id} className="border-b border-gray-100">
            <td className="py-2">{expense.name}</td>
            <td className="py-2">{formatCurrency(expense.value)}</td>
            <td className="py-2">{formatDate(expense.datePaid)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 3: Create `src/modules/financial/components/ExpenseFilter.tsx`**

```tsx
import { useExpenseTypes } from '@/api/queries/expenseTypes'
import type { ExpenseFilters } from '@/types/expense'

interface Props {
  householdId: string
  filters: ExpenseFilters
  onChange: (next: Partial<ExpenseFilters>) => void
  onClear: () => void
}

export const ExpenseFilter = ({
  householdId,
  filters,
  onChange,
  onClear,
}: Props) => {
  const { data: types } = useExpenseTypes(householdId)
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Type
        <select
          className="rounded border border-gray-300 px-2 py-1"
          value={filters.typeId ?? ''}
          onChange={(event) =>
            onChange({ typeId: event.target.value || undefined, page: 1 })
          }
        >
          <option value="">All types</option>
          {types?.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={onClear}
        className="rounded border border-gray-300 px-3 py-1 text-sm"
      >
        Clear
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/modules/financial/components/ExpenseForm.tsx`**

```tsx
import { useForm } from 'react-hook-form'
import { useCreateExpense } from '@/api/mutations/useCreateExpense'
import { useExpenseTypes } from '@/api/queries/expenseTypes'
import { usePaymentSources } from '@/api/queries/paymentSources'
import { useHousehold } from '@/contexts/useHousehold'
import { canManageExpenses } from '@/utils/permissions'
import { getErrorMessage } from '@/utils/errors'
import type { CreateExpenseInput } from '@/types/expense'

interface Props {
  onSuccess?: () => void
}

const today = () => new Date().toISOString().slice(0, 10)

export const ExpenseForm = ({ onSuccess }: Props) => {
  const { householdId, role, user } = useHousehold()
  const {
    mutate: createExpense,
    isPending,
    error,
  } = useCreateExpense(householdId)
  const { data: types } = useExpenseTypes(householdId)
  const { data: sources } = usePaymentSources(householdId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateExpenseInput>({
    defaultValues: {
      name: '',
      value: 0,
      typeId: '',
      sourceId: '',
      datePaid: today(),
      paidByUserId: user?.id ?? '',
    },
  })

  if (!canManageExpenses(role)) {
    return (
      <p className="text-sm text-gray-500">Only admins can add expenses.</p>
    )
  }

  const onSubmit = (data: CreateExpenseInput) => {
    createExpense(
      { ...data, value: Number(data.value) },
      {
        onSuccess: () => {
          reset()
          onSuccess?.()
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          className="rounded border border-gray-300 px-3 py-2"
          {...register('name', { required: 'Name is required' })}
        />
        {errors.name && (
          <span role="alert" className="text-xs text-red-600">
            {errors.name.message}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Amount
        <input
          type="number"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('value', {
            required: 'Amount is required',
            valueAsNumber: true,
            min: { value: 1, message: 'Must be positive' },
          })}
        />
        {errors.value && (
          <span role="alert" className="text-xs text-red-600">
            {errors.value.message}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Type
        <select
          className="rounded border border-gray-300 px-3 py-2"
          {...register('typeId', { required: 'Type is required' })}
        >
          <option value="">Select type</option>
          {types?.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
        {errors.typeId && (
          <span role="alert" className="text-xs text-red-600">
            {errors.typeId.message}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Source
        <select
          className="rounded border border-gray-300 px-3 py-2"
          {...register('sourceId', { required: 'Source is required' })}
        >
          <option value="">Select source</option>
          {sources?.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
        {errors.sourceId && (
          <span role="alert" className="text-xs text-red-600">
            {errors.sourceId.message}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Date paid
        <input
          type="date"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('datePaid', { required: 'Date is required' })}
        />
      </label>

      {error && (
        <p role="alert" className="text-xs text-red-600">
          {getErrorMessage(error)}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Add expense'}
      </button>
    </form>
  )
}
```

- [ ] **Step 5: Replace `src/modules/financial/pages/ExpensesPage.tsx`**

```tsx
import { useState } from 'react'
import { useHousehold } from '@/contexts/useHousehold'
import { useExpenseFilters } from '@/modules/financial/hooks/useExpenseFilters'
import { ExpenseTable } from '@/modules/financial/components/ExpenseTable'
import { ExpenseFilter } from '@/modules/financial/components/ExpenseFilter'
import { ExpenseForm } from '@/modules/financial/components/ExpenseForm'

export const ExpensesPage = () => {
  const { householdId } = useHousehold()
  const { filters, updateFilters, clearFilters, data, isLoading } =
    useExpenseFilters(householdId)
  const [showForm, setShowForm] = useState(false)

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <button
          type="button"
          onClick={() => setShowForm((open) => !open)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          {showForm ? 'Close' : 'Add expense'}
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <ExpenseForm onSuccess={() => setShowForm(false)} />
        </div>
      )}

      <ExpenseFilter
        householdId={householdId}
        filters={filters}
        onChange={updateFilters}
        onClear={clearFilters}
      />

      <ExpenseTable expenses={data?.items ?? []} isLoading={isLoading} />
    </section>
  )
}
```

- [ ] **Step 6: Write failing test `src/modules/financial/hooks/useExpenseFilters.test.tsx`**

```tsx
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '@/test/test-utils'
import { useExpenseFilters } from '@/modules/financial/hooks/useExpenseFilters'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    <MemoryRouter initialEntries={['/financial/expenses']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
)

describe('useExpenseFilters', () => {
  it('defaults page/limit/sort when the URL has no params', () => {
    const { result } = renderHook(() => useExpenseFilters('household-001'), {
      wrapper,
    })
    expect(result.current.filters.page).toBe(1)
    expect(result.current.filters.limit).toBe(25)
    expect(result.current.filters.sortOrder).toBe('desc')
  })

  it('writes filters into the URL via updateFilters', () => {
    const seen: string[] = []
    const Probe = () => {
      const location = useLocation()
      seen.push(location.search)
      return null
    }
    const { result } = renderHook(() => useExpenseFilters('household-001'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter initialEntries={['/financial/expenses']}>
            {children}
            <Probe />
          </MemoryRouter>
        </QueryClientProvider>
      ),
    })

    act(() =>
      result.current.updateFilters({ typeId: 'type-groceries', page: 1 }),
    )

    expect(seen[seen.length - 1]).toContain('type=type-groceries')
  })
})
```

- [ ] **Step 7: Run the filters test**

Run: `npm run test -- useExpenseFilters`
Expected: PASS (both).

- [ ] **Step 8: Write test `src/modules/financial/components/ExpenseForm.test.tsx`**

```tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { ExpenseForm } from '@/modules/financial/components/ExpenseForm'

describe('ExpenseForm', () => {
  it('blocks members from adding expenses', () => {
    renderWithProviders(<ExpenseForm />, { household: { role: 'member' } })
    expect(
      screen.getByText(/only admins can add expenses/i),
    ).toBeInTheDocument()
  })

  it('submits a valid expense and calls onSuccess', async () => {
    const onSuccess = vi.fn()
    renderWithProviders(<ExpenseForm onSuccess={onSuccess} />)

    // Wait for type/source options (from MSW) to load.
    await screen.findByRole('option', { name: 'Groceries' })

    await userEvent.type(screen.getByLabelText(/name/i), 'Coffee')
    await userEvent.type(screen.getByLabelText(/amount/i), '25000')
    await userEvent.selectOptions(
      screen.getByLabelText(/type/i),
      'type-groceries',
    )
    await userEvent.selectOptions(
      screen.getByLabelText(/source/i),
      'source-cash',
    )
    await userEvent.click(screen.getByRole('button', { name: /add expense/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })
})
```

- [ ] **Step 9: Run the form test + full suite + type-check + lint + build**

Run: `npm run test && npm run type-check && npm run lint && npm run build`
Expected: all PASS. The vertical slice is now complete end-to-end.

- [ ] **Step 10: Manual dev smoke (optional but recommended)**

Run: `npm run dev`, open the app. Expected flow: redirected to `/auth/login` → sign in with any email/password → land on `/dashboard` → navigate to Expenses → see seeded rows → add an expense → row appears immediately (optimistic) → filter by type updates the URL (`?type=...`).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add expenses UI with URL-based filters and create form

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Capacitor Configuration

**Files:**

- Create: `capacitor.config.ts`
- Modify: `package.json` (cap scripts)
- Modify: `.gitignore` (ignore generated native projects)

**Interfaces:**

- Consumes: `@capacitor/core` (T1 runtime dep), `@capacitor/cli`/`ios`/`android` (T1 dev deps).
- Produces: valid `capacitor.config.ts` pointing at `dist`; `cap:sync`, `cap:ios`, `cap:android` scripts.

- [ ] **Step 1: Create `capacitor.config.ts`**

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.household.app',
  appName: 'Household',
  webDir: 'dist',
}

export default config
```

- [ ] **Step 2: Add cap scripts to `package.json` `"scripts"`**

```json
{
  "cap:sync": "cap sync",
  "cap:ios": "cap open ios",
  "cap:android": "cap open android"
}
```

- [ ] **Step 3: Ignore generated native projects** — append to `.gitignore`:

```gitignore
# Capacitor native projects (generated via `npx cap add ios|android`)
/ios
/android
```

- [ ] **Step 4: Verify config type-checks**

Run: `npx tsc --noEmit capacitor.config.ts`
Expected: no errors. (Config is validated by the Capacitor CLI type.)

Note: Do NOT run `npx cap add ios|android` here — it requires Xcode/CocoaPods (iOS) or Android Studio/SDK (Android). Document instead (see Task 12 README). The build output dir (`dist`) is produced by `npm run build`, which `cap sync` consumes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add Capacitor config and native build scripts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: CI Workflows

**Files:**

- Create: `.github/workflows/ci.yml`, `.github/workflows/security.yml`

**Interfaces:**

- Consumes: npm scripts `lint`, `type-check`, `test`, `build` (T1).
- Produces: two GitHub Actions workflows.

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
```

- [ ] **Step 2: Create `.github/workflows/security.yml`**

```yaml
name: Security

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - name: npm audit
        run: npm audit --audit-level=moderate
      # - name: Snyk scan (requires SNYK_TOKEN secret)
      #   uses: snyk/actions/node@master
      #   env:
      #     SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

- [ ] **Step 3: Validate YAML syntax**

Run: `node -e "const fs=require('fs');['./.github/workflows/ci.yml','./.github/workflows/security.yml'].forEach(f=>console.log(f, fs.readFileSync(f,'utf8').length>0?'ok':'empty'))"`
Expected: both print `ok`. (Optionally lint with `npx --yes yaml-lint` if available.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "ci: add build/test and security audit workflows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Formatting, Git Hooks, Docs & Final Verification

**Files:**

- Create: `prettier.config.js`, `.prettierignore`
- Create: `.husky/pre-commit`
- Modify: `package.json` (add `prepare`, `format` scripts + `lint-staged` config)
- Modify: `README.md`

**Interfaces:**

- Consumes: everything.
- Produces: Prettier config, a working pre-commit hook running `lint-staged`, updated docs, and a fully green verification run.

- [ ] **Step 1: Create `prettier.config.js`**

```js
/** @type {import('prettier').Config} */
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 80,
  plugins: ['prettier-plugin-tailwindcss'],
}
```

- [ ] **Step 2: Create `.prettierignore`**

```gitignore
dist
node_modules
public/mockServiceWorker.js
package-lock.json
ios
android
```

- [ ] **Step 3: Add scripts + lint-staged config to `package.json`**

Add to `"scripts"`:

```json
{
  "format": "prettier --write .",
  "prepare": "husky"
}
```

Add a top-level `"lint-staged"` key:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,css,md}": ["prettier --write"]
  }
}
```

- [ ] **Step 4: Initialize Husky and create the pre-commit hook**

Run: `npx husky init`
Then overwrite `.husky/pre-commit` with:

```sh
npx lint-staged
```

- [ ] **Step 5: Format the whole codebase once**

Run: `npm run format`
Expected: Prettier rewrites files to the configured style. Re-run `npm run lint` to confirm no conflicts.

- [ ] **Step 6: Rewrite `README.md`**

````markdown
# Household App — Frontend

Tenant-aware React app for managing a household's finances. Built per
`FE-Architecture-REVISED.md`.

## Stack

React 19 · Vite 8 · TypeScript (strict) · React Router 7 · TanStack Query 5 ·
React Hook Form · Tailwind v4 · Vitest + Testing Library + MSW · Capacitor.

## State ownership

- **Server state** → TanStack Query (tenant-scoped query keys)
- **Filters** → URL params (`useSearchParams`)
- **Session** → `HouseholdContext`
- **Local UI** → `useState`

No Zustand, no global store.

## Getting started

```bash
npm install
npm run dev        # runs with the MSW mock backend (VITE_ENABLE_MOCKS=true)
```
````

Copy `.env.example` to `.env.local` and set `VITE_API_URL` to point at a real
backend; set `VITE_ENABLE_MOCKS=false` to disable mocks.

## Scripts

| Script                  | Purpose                       |
| ----------------------- | ----------------------------- |
| `npm run dev`           | Dev server (MSW mocks in dev) |
| `npm run build`         | Type-check + production build |
| `npm run test`          | Run Vitest suite              |
| `npm run test:watch`    | Vitest watch mode             |
| `npm run test:coverage` | Coverage report               |
| `npm run lint`          | ESLint                        |
| `npm run type-check`    | `tsc` no-emit                 |
| `npm run format`        | Prettier write                |

## Mobile (Capacitor)

Config lives in `capacitor.config.ts` (`webDir: dist`). Generating native
projects needs local toolchains (Xcode + CocoaPods for iOS, Android Studio +
SDK for Android):

```bash
npm run build
npx cap add ios        # or: npx cap add android
npm run cap:sync
npm run cap:ios        # opens Xcode
```

## Project structure

See `docs/superpowers/specs/2026-07-26-household-fe-init-design.md` §5.

```

- [ ] **Step 7: FINAL VERIFICATION — run the full gate**

Run: `npm run lint && npm run type-check && npm run test && npm run build`
Expected: ALL PASS. This is the success gate from the spec §13.

- [ ] **Step 8: Verify the pre-commit hook fires**

Run: `git add -A && git commit -m "chore: add Prettier, Husky pre-commit, and project docs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`
Expected: `lint-staged` runs on staged files before the commit is created; commit succeeds.

---

## Post-Plan Verification Checklist (maps to spec §13)

- [ ] `npm run dev` serves login → dashboard → expenses on MSW.
- [ ] `npm run build`, `npm run lint`, `npm run type-check`, `npm run test` all pass.
- [ ] Folder structure matches spec §5; no `/stores`, no Zustand in `package.json`.
- [ ] Adding a type filter updates the URL (`?type=...`) and refetches.
- [ ] Creating an expense updates the list optimistically.
- [ ] Runtime deps are exact-pinned in `package.json` (no `^`/`~`).
```
