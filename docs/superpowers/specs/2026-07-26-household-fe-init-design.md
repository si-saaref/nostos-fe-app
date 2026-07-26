# Household FE — Project Initialization Design

**Date:** 2026-07-26
**Status:** Approved (design), pending implementation plan
**Source docs:** `FE-Architecture.md`, `FE-Architecture-REVISED.md`

## 1. Goal

Take the existing default Vite + React scaffold and initialize it into the
architecture described in `FE-Architecture-REVISED.md`: a tenant-aware React
app whose server state is owned by TanStack Query, filters live in the URL,
session lives in Context, and local UI lives in `useState`. Deliver a working
vertical slice (auth + expenses) running against MSW mocks, plus the full
infrastructure (Tailwind, testing, Capacitor, CI, git hooks).

Scope selected by the user: **Full setup** (skeleton + vertical slice + Tailwind
+ Vitest/MSW + Capacitor + CI + Husky/lint-staged).

## 2. Starting Point

The repo already contains a default Vite template:
- Vite 8, React 19.2, TypeScript 6, ESLint 10 (flat config) — installed.
- Only `react` / `react-dom` as runtime deps.
- `src/App.tsx`, `src/main.tsx`, demo assets/CSS.
- Node 22.17.1, npm 11.7.0.

The demo App/assets will be replaced. `main.tsx`, `index.html`, ESLint config
are kept and extended.

## 3. Decisions (where the docs were ambiguous or outdated)

| Topic | Decision | Reason |
|-------|----------|--------|
| React version | **19** (keep installed) | Doc says 18, but 19 is installed & current |
| State mgmt | **TanStack Query + URL + Context + useState**, no Zustand, no `/stores` | REVISED doc supersedes original |
| Routing | **React Router 7** (`react-router-dom`) | REVISED code samples use `useSearchParams`/guards; ignore stray `@tanstack/react-router` pin |
| Styling | **Tailwind v4** via `@tailwindcss/vite` (CSS-first `@import`) | Current approach for Vite 8; no v3 `tailwind.config.js` needed |
| Dep pinning | **Exact versions** for runtime deps | REVISED supply-chain section |
| TypeScript | Enable `strict: true` (not currently set) | Doc requires strict mode |
| Dev data | **MSW** for both browser (dev) and node (tests) | App runs standalone; handlers reused in tests |

## 4. Dependencies to Add

**Runtime (exact-pinned):**
`@tanstack/react-query`, `react-router-dom`, `react-hook-form`, `axios`,
`@capacitor/core`.

**Dev:**
`@tanstack/react-query-devtools`, `tailwindcss` + `@tailwindcss/vite`,
`vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`,
`@testing-library/user-event`, `msw`, `@vitest/coverage-v8`,
`@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`,
`prettier`, `prettier-plugin-tailwindcss`, `husky`, `lint-staged`.

## 5. Folder Structure (REVISED §4 — no `/stores`)

```
src/
├── api/
│   ├── client.ts            Axios instance + interceptors (X-Household-ID, 401/403)
│   ├── queryClient.ts       QueryClient config (staleTime, retry, gcTime)
│   ├── types.ts             API response envelope + error types
│   ├── queries/
│   │   ├── session.ts       useSession
│   │   ├── expenses.ts      EXPENSE_KEYS, useExpenses, useExpense
│   │   ├── expenseTypes.ts  useExpenseTypes
│   │   ├── paymentSources.ts usePaymentSources
│   │   └── users.ts         useUsers
│   └── mutations/
│       ├── useCreateExpense.ts   (optimistic)
│       ├── useUpdateExpense.ts
│       └── useDeleteExpense.ts
├── contexts/
│   ├── HouseholdContext.tsx  Provider: user, household, householdId, role, isAuthenticated
│   └── useHousehold.ts       hook (throws outside provider)
├── hooks/
│   ├── useDebounce.ts
│   └── useLocalStorage.ts
├── modules/
│   ├── auth/
│   │   ├── pages/LoginPage.tsx
│   │   ├── components/LoginForm.tsx   (React Hook Form)
│   │   ├── api/useLogin.ts, useLogout.ts
│   │   └── types/auth.ts
│   └── financial/
│       ├── pages/ExpensesPage.tsx
│       ├── components/ExpenseTable.tsx, ExpenseFilter.tsx, ExpenseForm.tsx
│       ├── hooks/useExpenseFilters.ts  (URL params <-> query)
│       └── types/expense.ts, filter.ts
├── components/
│   ├── Layout/DashboardLayout.tsx, AuthLayout.tsx
│   ├── Navbar.tsx, Loading.tsx, ErrorBoundary.tsx, PermissionGuard.tsx
├── pages/
│   ├── DashboardPage.tsx, NotFoundPage.tsx, ErrorPage.tsx
├── routes/
│   ├── index.tsx            router config (createBrowserRouter, lazy modules)
│   ├── ProtectedRoute.tsx   auth guard
│   └── PermissionRoute.tsx  role guard
├── mocks/
│   ├── data.ts              seed households/users/expenses/types/sources
│   ├── handlers.ts          MSW request handlers (tenant-aware)
│   ├── browser.ts           setupWorker (dev)
│   └── server.ts            setupServer (tests)
├── test/
│   ├── setup.ts             jest-dom + MSW server lifecycle
│   └── test-utils.tsx       renderWithProviders + createWrapper
├── styles/globals.css       @import "tailwindcss" + base tokens
├── types/
│   ├── household.ts, expense.ts, api.ts, index.ts
├── utils/
│   ├── formatters.ts (formatCurrency/formatDate), validators.ts,
│   ├── permissions.ts, errors.ts
├── App.tsx                  providers composition + RouterProvider
└── main.tsx                 entry (starts MSW worker in dev, then renders)
```

## 6. Key Component Contracts

- **`apiClient`** (`api/client.ts`): `withCredentials: true`, `baseURL` from
  `VITE_API_URL`. Request interceptor attaches `X-Household-ID` (read from a
  module-level setter fed by the context, not a hook — interceptors can't call
  hooks). Response interceptor: 401 → redirect `/auth/login`; 403 → surface a
  permission error.
- **`HouseholdContext`**: fetches `GET /api/auth/session` with
  `staleTime: Infinity`; exposes `{ user, household, householdId, role,
  isAuthenticated, isLoading }`. Writes `householdId` into the axios setter.
- **`useExpenseFilters(householdId)`**: reads filters from `useSearchParams`,
  feeds them to `useExpenses`, returns `{ filters, data, isLoading, updateFilters,
  clearFilters }`. Filters: `dateFrom/dateTo/type/source/page/limit/sortBy/order`.
- **`useCreateExpense(householdId)`**: optimistic insert into the list cache,
  rollback on error, invalidate on settle.
- **Query keys**: `EXPENSE_KEYS` factory keyed by `householdId` + filters, so
  cache is tenant-scoped (REVISED §5).
- **Route guards**: `ProtectedRoute` redirects unauthenticated users to
  `/auth/login`; `PermissionRoute requiredRole="admin"` redirects non-admins to
  `/dashboard`.

## 7. Vertical Slice Behavior (on MSW)

1. Visit app → session fetch fails (no cookie) → redirect `/auth/login`.
2. Login form (RHF, validated) → `POST /api/auth/login` → mock sets a session →
   session query refetched → redirect `/dashboard`.
3. `/financial/expenses`: list renders from `GET /api/expenses` (tenant-filtered
   by `X-Household-ID`), filter bar edits the URL, create form adds an expense
   optimistically via `POST /api/expenses`.
4. MSW handlers: `auth/{login,logout,session}`, `expenses` CRUD,
   `expense-types`, `payment-sources`, `users` — all scoped by household header.

## 8. Config Changes

- **`vite.config.ts`**: add `@tailwindcss/vite` + React plugins, `@` → `src`
  alias, and Vitest `test` block (`environment: 'jsdom'`, `setupFiles`,
  `globals: true`).
- **`tsconfig.app.json`**: add `"strict": true` and `paths: { "@/*": ["src/*"] }`
  (+ `baseUrl`).
- **`package.json` scripts**: `type-check`, `test`, `test:watch`,
  `test:coverage`, `format`, `cap:sync`, `cap:ios`, `cap:android`, `prepare`
  (husky), plus `lint-staged` config.
- **`.env.example`**: `VITE_API_URL`, `VITE_APP_NAME`, `VITE_ENABLE_MOCKS`.
- **`capacitor.config.ts`**: `appId`, `appName: 'Household'`, `webDir: 'dist'`.

## 9. Testing

- Vitest + Testing Library + MSW (`server.ts`). `test/setup.ts` starts/stops the
  server and resets handlers between tests. `test-utils` provides
  `renderWithProviders` (QueryClient with retries off + MemoryRouter +
  HouseholdProvider) and a `renderHook` wrapper.
- Initial tests: `useExpenses` (success + error), `ExpenseForm` submit path,
  `LoginForm` submit path. Purpose is to prove the harness works, not full
  coverage.

## 10. CI / Hooks

- `.github/workflows/ci.yml`: `npm ci` → `lint` → `type-check` → `test` →
  `build` on push/PR to `main`.
- `.github/workflows/security.yml`: `npm audit --audit-level=moderate`; Snyk
  step included but commented (requires `SNYK_TOKEN`).
- Husky `pre-commit` → `lint-staged` (`eslint --fix` + `prettier --write` on
  staged files).

## 11. Capacitor Caveat

Config, deps, and `cap:*` scripts are set up. Actually generating the native
`ios/` and `android/` projects (`npx cap add ios|android`) requires Xcode +
CocoaPods / Android Studio on the machine. The plan will attempt it and, if the
native toolchains are absent, stop at config + document the command rather than
fail the init. `ios/` and `android/` will be gitignored if generated.

## 12. Out of Scope (YAGNI for this init)

- Signup / password-reset flows (login only for the slice).
- Non-financial modules (tasks, notes, meal-plan) — folders not created until
  needed.
- Real backend integration, i18n, PWA icons, charts.
- Zustand / Redux (explicitly excluded by REVISED).

## 13. Success Criteria

- `npm run dev` serves a working login → dashboard → expenses flow on MSW.
- `npm run build`, `npm run lint`, `npm run type-check`, `npm run test` all pass.
- Folder structure matches §5; no `/stores`, no Zustand.
- Adding a filter updates the URL and refetches; creating an expense updates the
  list optimistically.
