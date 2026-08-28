# FRONTEND.md

The single authoritative document for this repository: what is built, how it is wired, where
it disagrees with its own specs, and what is still open. Written to be read cold. This file
describes **this repo**; it wins any disagreement with the architecture and PRD documents in
the vault, which describe the household app in general.

Treat it as living: when a change invalidates something here, update it in the same commit,
the way you would update a test.

**Last verified against the code:** 2026-08-27 — 11 test files / 23 tests passing, build clean
(`vite v8.1.5`, 162 modules).

---

## 1. What this is

**NOSTOS App (family-facing)** — the tenant-aware React app a household uses to track shared
spending. It is _not_ the Operator Console; console code lives in its own repo.

Product intent, users, terminology and brand live in the vault (see §14). Read those for
_why_; read this for _how_.

**Shipped surface.** Email + password signin, a session-backed protected shell, a dashboard
placeholder, and an expenses page with server-driven list, URL-backed filters, and a create
form. MSW mock backend for local dev. CI runs lint + type-check + test + build.

**Not built.** No expense edit or delete UI. No mobile card view. No modals of any kind. No
logout control. No permission gating in the router. No settings, invites, or member
management. No error tracking or analytics. Capacitor is configured but no native project is
generated.

---

## 2. Commands

```bash
npm install
npm run dev            # Vite dev server; MSW mocks on unless VITE_ENABLE_MOCKS=false
npm run build          # tsc -b && vite build
npm run lint           # ESLint, flat config
npm run type-check     # tsc -b, no emit
npm run test           # Vitest, one shot
npm run test:watch     # Vitest watch
npm run test:coverage  # v8 coverage
npm run format         # Prettier write

npx vitest run --reporter=dot            # full suite, quiet
npx vitest run -t 'name of a test'       # one test
```

CI (`.github/workflows/ci.yml`) runs `lint → type-check → test → build` on Node 22 and uploads
`dist/`. Running those four locally is the equivalent gate.

---

## 3. Five things that bite

1. **Members cannot create expenses, and that contradicts the spec.** `ExpenseForm` opens with
   `if (!canManageExpenses(role))` → _"Only admins can add expenses."_
   (`src/modules/financial/components/ExpenseForm.tsx:42`). `canManageExpenses` is
   `role === 'admin'`. But the permission matrix in the master document is
   `Create | Member ✅ | Admin ✅`, and the Expenditure FE PRD says to hide **edit/delete** for
   members — not create. The gate is applied to the wrong operation. See §10.

2. **This repo authenticates with a password; the current spec says it should not.**
   `useLogin` posts `{ email, password }` to `/auth/login`. `notes/FE-App/prd-auth-fe.md`
   v3.1 (2026-08-27) specifies **passwordless magic links**, with passwords explicitly
   deferred to Phase 2. The code predates that PRD and has not been migrated.

3. **The household id reaches axios through module scope, not React.** `api/client.ts` keeps
   `currentHouseholdId` in a module variable; `HouseholdProvider` calls `setHouseholdId()`
   **synchronously during render**, not in an effect, so the `X-Household-ID` request
   interceptor is populated before any descendant's first effect fires. That ordering is
   load-bearing — a deep link straight to `/financial/expenses` sends an unscoped request if
   you move that call into `useEffect`.

4. **The 401 interceptor has two deliberate exemptions.** It redirects to `/auth/login` only
   when the path does not already start with `/auth` **and** the failing request is not
   `/auth/session`. Without the second exemption the session probe on a logged-out visitor
   triggers a redirect loop.

5. **Half the permission and mutation layer is dead code.** `PermissionRoute`,
   `PermissionGuard`, `hasRole`, `useLogout`, `useUpdateExpense` and `useDeleteExpense` all
   have **zero call sites**. They typecheck and ship in the bundle but nothing renders or
   invokes them. See §10.

---

## 4. Stack

| Concern      | Choice                                    | Version               |
| ------------ | ----------------------------------------- | --------------------- |
| UI           | React                                     | 19.2.8                |
| Language     | TypeScript (strict)                       | ~6.0.2                |
| Build / dev  | Vite                                      | 8                     |
| Routing      | react-router-dom                          | 7.18.1 (exact-pinned) |
| Server state | @tanstack/react-query                     | 5.101.4               |
| Forms        | react-hook-form                           | 7.83.0                |
| HTTP         | axios                                     | 1.18.1                |
| Styling      | Tailwind CSS v4 via `@tailwindcss/vite`   | 4.3.3                 |
| Test         | Vitest 4 + @testing-library/react + MSW 2 | —                     |
| Mobile       | @capacitor/core                           | 8.4.2                 |

`@/` resolves to `src/`. **No component library is installed** — no Radix, no Headless UI,
despite both being named in the vault's locked-stack table. Every element in `src/` is a plain
Tailwind-styled DOM node.

---

## 5. State ownership

| Kind of state                   | Owner                                                  |
| ------------------------------- | ------------------------------------------------------ |
| Server data                     | TanStack Query, keyed by household                     |
| Filters, sorting, pagination    | URL params (`useSearchParams`) via `useExpenseFilters` |
| Session (user, household, role) | `HouseholdContext`                                     |
| Local UI (form open/closed)     | `useState`                                             |

No Zustand, no Redux, no global store. This is the binding decision from the architecture
document and the code holds to it.

---

## 6. Module layout

```
src/
├── api/
│   ├── client.ts          axios instance + both interceptors
│   ├── queryClient.ts     staleTime 5m, gcTime 10m, no refetch-on-focus, retry 2
│   ├── queries/           expenses, expenseTypes, paymentSources, users, session
│   └── mutations/         useCreateExpense, useUpdateExpense*, useDeleteExpense*
├── components/            ErrorBoundary, Loading, Navbar, PermissionGuard*, Layout/
├── contexts/              HouseholdContext + useHousehold
├── mocks/                 MSW handlers, browser + server entry points
├── modules/
│   ├── auth/              LoginForm, LoginPage, useLogin, useLogout*
│   └── financial/         ExpenseFilter, ExpenseForm, ExpenseTable, useExpenseFilters
├── pages/                 DashboardPage, ErrorPage, NotFoundPage
├── routes/                router, ProtectedRoute, PermissionRoute*
├── types/  utils/  test/
```

`*` = present but never called. See §10.

---

## 7. Routes

| Path                  | Element                                  | Guard            |
| --------------------- | ---------------------------------------- | ---------------- |
| `/auth/login`         | `LoginPage` inside `AuthLayout`          | none             |
| `/`                   | redirect → `/dashboard`                  | `ProtectedRoute` |
| `/dashboard`          | `DashboardPage` inside `DashboardLayout` | `ProtectedRoute` |
| `/financial/expenses` | `ExpensesPage` (lazy + `Suspense`)       | `ProtectedRoute` |
| `*`                   | `NotFoundPage`                           | none             |

`ExpensesPage` is the only lazy route, which is why it gets its own 7 kB chunk. `ErrorPage` is
the `errorElement` on both layout branches. **No route uses `PermissionRoute`** — role is
enforced only inside `ExpenseForm`, and incorrectly (§3.1).

---

## 8. Auth and session

`useSession()` GETs `/auth/session` and is the single source of session truth.
`HouseholdProvider` derives `user`, `household`, `householdId`, `role` (defaulting to
`'member'`), `isAuthenticated` and `isLoading` from it, and pushes `householdId` into the axios
module scope during render.

`ProtectedRoute` renders `Loading` while `isLoading`, redirects to `/auth/login` when not
authenticated, and otherwise renders children.

Login and logout both invalidate `SESSION_KEY` (`['auth', 'session']`) on success — logout's
hook exists but no UI calls it.

---

## 9. API contract and data fetching

Base URL `VITE_API_URL || '/api'`, `withCredentials: true`. Every request carries
`X-Household-ID` when a household id is known.

**Query keys.** Hierarchical and household-scoped:

```
EXPENSE_KEYS.all                        ['expenses']
EXPENSE_KEYS.byHousehold(hid)           [...all, hid]
EXPENSE_KEYS.lists(hid)                 [...byHousehold, 'list']
EXPENSE_KEYS.list(hid, filters)         [...byHousehold, 'list', filters ?? {}]
EXPENSE_KEYS.detail(hid, id)            [...byHousehold, 'detail', id]
SESSION_KEY                             ['auth', 'session']
```

`EXPENSE_TYPE_KEYS`, `PAYMENT_SOURCE_KEYS` and `USER_KEYS` follow the same household-scoped
shape. Because `lists(hid)` is a strict prefix of `list(hid, filters)`, invalidating the former
correctly clears every filter permutation.

**Mutations.** `useCreateExpense` is the only one with an optimistic update (cancel → snapshot
→ `setQueryData` → rollback in `onError` → invalidate in `onSettled`). `useUpdateExpense` and
`useDeleteExpense` invalidate `byHousehold` on success with no optimistic path — and neither
is wired to a control.

**Mock backend.** MSW starts in dev unless `VITE_ENABLE_MOCKS=false`, with
`onUnhandledRequest: 'bypass'`. Ten handlers cover session/login/logout, expenses CRUD,
expense types, payment sources and users. `enableMocking()` uses `.finally()` so a mock-worker
failure still boots the app rather than leaving a blank page.

---

## 10. Known defects and unwired code

| #   | Item                       | Detail                                                                                               |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | **Create gated to admin**  | `ExpenseForm.tsx:42` blocks members from creating; spec grants members create. Wrong operation gated |
| 2   | **Password auth vs. spec** | Repo ships email+password; `prd-auth-fe.md` v3.1 mandates passwordless magic links                   |
| 3   | `PermissionRoute`          | 0 call sites                                                                                         |
| 4   | `PermissionGuard`          | 0 call sites                                                                                         |
| 5   | `hasRole`                  | 0 call sites                                                                                         |
| 6   | `useLogout`                | 0 call sites — no logout control exists in the UI                                                    |
| 7   | `useUpdateExpense`         | 0 call sites — no edit UI                                                                            |
| 8   | `useDeleteExpense`         | 0 call sites — no delete UI                                                                          |

**Components the Expenditure FE PRD requires that do not exist:** `ExpenseList`,
`ExpenseCard` (mobile), `ExpenseRow`, `DeleteConfirmModal`, `ExpenseStats`, and the
`useExpenseActions` hook. Create is an inline expanding panel, not the modal the PRD specifies.

---

## 11. Build and performance

```
dist/assets/index-*.js          400.87 kB │ gzip: 129.68 kB
dist/assets/ExpensesPage-*.js     7.02 kB │ gzip:   2.29 kB
dist/assets/index-*.css          17.57 kB │ gzip:   4.04 kB
```

One lazy chunk (`ExpensesPage`). The main bundle carries React, Router, Query, RHF and axios;
nothing is currently split out of it.

---

## 12. Accessibility — real status

**What holds.** Form inputs use implicit labelling — `<label>` wraps its `<input>`, so the
accessible name is correct without `htmlFor`. Field errors carry `role="alert"`. `Loading`
uses `role="status"` with `aria-live="polite"`.

**What does not.** No focus management anywhere: no `onKeyDown` handlers, no Escape handling,
no focus trap, no focus restoration. No skip link. Colour contrast has never been audited
against the 4.5:1 target. The PRD asks for WCAG 2.1 AA and the app is not there — though the
absence of a focus trap is moot until the first modal is built.

---

## 13. Testing, environment and deployment

**Tests.** 11 files / 23 tests, Vitest + jsdom, setup at `src/test/setup.ts`, MSW server for
node. Covered: axios client, session/expense queries, `useCreateExpense`, `useExpenseFilters`,
`HouseholdContext`, `ProtectedRoute`, `LoginForm`, `ExpenseForm`, formatters, permissions, mock
handlers. Not covered: routing composition, `ExpenseTable`, `ExpenseFilter`, error boundary.

**Environment** (`.env.example`):

```
VITE_API_URL=/api        # backend base URL
VITE_APP_NAME=Household
VITE_ENABLE_MOCKS=true   # "false" disables the MSW worker in dev
```

**Security.** `.github/workflows/security.yml` runs `npm audit --audit-level=moderate` weekly
(Mon 06:00 UTC) and per PR, `continue-on-error: true` — **informational, never a gate**.
Accepted advisory: `react-router-dom@7.18.1`, GHSA-qwww-vcr4-c8h2 (HIGH, RSC-mode CSRF
bypass). This is a client-only SPA that does not use React Router's RSC mode, so it does not
apply. The dependency is exact-pinned; revisit when a patched release ships.

**Mobile.** `capacitor.config.ts` with `webDir: dist`. `/ios` and `/android` are gitignored and
must be generated locally (`npx cap add ios|android`), which needs Xcode + CocoaPods or Android
Studio + SDK.

---

## 14. Document map

The Nostos vault is the source of truth for product and architecture. It is symlinked at
`notes/` (→ `~/Documents/my-vault/Nostos`) and is **not** part of this repo. Never copy a vault
document into the repo — link to it.

| File                                   | What it is                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `README.md`                            | Orientation and setup                                                                                      |
| `docs/FRONTEND.md`                     | **This file** — authoritative technical record for this repo                                               |
| `docs/superpowers/plans/`              | Historical implementation plan                                                                             |
| `docs/superpowers/specs/`              | Design spec for the initial build                                                                          |
| `notes/NOSTOS - Master Document.md`    | Master reference: stack, patterns, permissions, phases, decision log                                       |
| `notes/FE-Console/FE-Architecture.md`  | Household-app-wide frontend architecture. Broader than this repo; the Console repo points at the same file |
| `notes/FE-App/prd-expenditure-fe.md`   | Expenditure FE PRD — components, validation, 17 acceptance criteria                                        |
| `notes/FE-App/prd-auth-fe.md`          | Auth FE PRD v3.1 — passwordless magic links                                                                |
| `notes/MASTER_PRD_AUTH_NOSTOS.md`      | Auth master PRD v3.1                                                                                       |
| `notes/MASTER_PRD_EXPENDITURE.md`      | Expenditure master PRD                                                                                     |
| `notes/AUTH-CROSS-CHECK-GAP-REPORT.md` | App vs. Console auth reconciliation                                                                        |
| `notes/BE/`                            | Backend architecture and PRDs, kept as contract references                                                 |

**Sibling repos.** The vault documents this app, the Operator Console (`fe-console-app-react/`)
and the backend (`be-app/`) together, so some of its citations are repo-relative paths that
only resolve inside their home repo. The one that matters here:

| Cited as                                                            | Actually lives at                                                                                                                  |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `docs/superpowers/specs/2026-08-27-auth-nostos-alignment-design.md` | `be-app/docs/superpowers/specs/2026-08-27-auth-nostos-alignment-design.md` — the authoritative auth v3.1 design record (465 lines) |

`docs/archive.local/` is gitignored and holds superseded documents kept only for reference —
currently `FE-Architecture-original-draft.md`, the pre-revision draft.

`PRODUCT.md` and `DESIGN.md` are Impeccable-managed and regenerated at the repo root; neither
is present right now.

---

## 15. Open items

1. **Decide the auth direction.** Either migrate to magic links per `prd-auth-fe.md` v3.1, or
   record in the vault that the app keeps passwords for Phase 1. The two currently disagree
   silently.
2. **Fix the create gate** (§3.1) — one-line change, but confirm the intended matrix first.
3. **Wire or delete** the six unused exports in §10. Dead permission code is worse than none.
4. **Build the missing Expenditure surfaces** — edit/delete modals, mobile card view, stats.
5. **The auth v3.1 design record is cited by an unresolvable path.** Six vault documents cite
   `docs/superpowers/specs/2026-08-27-auth-nostos-alignment-design.md` as the authority that
   "wins any disagreement" for auth v3.1 — including `BE/BACKEND.md`, which sends a reader to
   its **§6.1** for the per-request `AuthGuard` lookup. The document is real (465 lines) but
   lives in the **be-app** repo at that repo-relative path, so the citation only resolves for
   someone standing in `be-app`. From this repo, from the console repo, and from inside the
   vault where all six citing documents actually live, it resolves to nothing. Fix by making
   the citations repo-qualified (`be-app/docs/…`) or by mirroring the spec into the vault
   alongside the PRDs that depend on it.
6. ~~`notes/MASTER_PRD_EXPENDITURE.md` lists "password reset" as an auth dependency.~~
   **Accepted, no action** — passwords are a known Phase 2 consideration, so the dependency
   line stands. Recorded here so a future audit does not re-raise it.
7. **Reconcile the locked-stack table** — the master document names React 18 and Radix/Headless
   UI; this repo runs React 19 with no component library.
