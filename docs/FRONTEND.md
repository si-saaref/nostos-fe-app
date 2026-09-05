# FRONTEND.md

The single authoritative document for this repository: what is built, how it is wired, where
it disagrees with its own specs, and what is still open. Written to be read cold. This file
describes **this repo**; it wins any disagreement with the architecture and PRD documents in
the vault, which describe the household app in general.

Treat it as living: when a change invalidates something here, update it in the same commit,
the way you would update a test.

**Last verified against the code:** 2026-08-29 — 12 test files / 30 tests passing, build clean
(`vite v8.1.5`, 451 modules).

> **This file exists twice.** An identical copy lives at `notes/FE-App/FRONTEND.md` in the
> vault. Two hand-synced authoritative documents is exactly the drift §14 warns about; see
> §15.8 for the decision that needs making.

---

## 1. What this is

**NOSTOS App (family-facing)** — the tenant-aware React app a household uses to track shared
spending. It is _not_ the Operator Console; console code lives in its own repo.

Product intent, users, terminology and brand live in the vault (see §14) and in `PRODUCT.md`
at the repo root. Read those for _why_; read this for _how_.

**Shipped surface.** Email + password signin, a session-backed app shell with a left sidebar
(bottom tab bar on mobile), a dashboard placeholder, a fully built **expenses ledger**, and a
**settings section** covering categories, accounts, members and preferences. Three themes and
two languages, both switchable at runtime. MSW mock backend for local dev. CI runs
lint + type-check + test + build.

**Not built.** No expense **edit** UI (`useUpdateExpense` is still unwired). No logout control.
No permission gating in the router. No error tracking or analytics. Capacitor is configured
but no native project is generated. Income, Investments/Savings and Plan appear in the sidebar
as explicitly-disabled "soon" entries and have no code behind them.

---

## 2. Commands

```bash
npm install
npm run dev            # Vite dev server; MSW mocks on unless VITE_ENABLE_MOCKS=false
npm run build          # tsc -b && vite build (compiles Paraglide messages first)
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

## 3. Six things that bite

1. **`src/paraglide/` is generated — never edit it, never commit it.** The Paraglide Vite
   plugin compiles `messages/{id,en}.json` into `src/paraglide/` on every build. It is
   gitignored, eslint-ignored, and prettier-ignored. Message **keys** are snake_case on
   purpose: Paraglide derives JS identifiers from them, and camelCase keys come out mangled
   (`action.recordLong` → `action_recordlong1`).

2. **Read messages through `useMessages()`, not by importing `m` directly.** Paraglide
   messages are plain function calls that read the ambient locale when invoked, so a component
   that imports `m` directly keeps rendering the previous language until something else
   re-renders it. `useMessages()` subscribes the component and returns `m` in one call, which
   makes using messages and subscribing to them the same act. This was a real bug: the filter
   row stayed English while the rest of the app switched to Indonesian.

3. **Forms carry `noValidate`, deliberately.** Native constraint validation silently refuses to
   submit `<input type="email">` with a non-ASCII address, and `<input type="date" max=…>` with
   an out-of-range date — the submit handler never runs, so our own validation never fires and
   the user is told _nothing_. Both `ExpenseForm` and the invite form own their rules; do not
   remove `noValidate` without moving the messages somewhere the user can see.

4. **The household id reaches axios through module scope, not React.** `api/client.ts` keeps
   `currentHouseholdId` in a module variable; `HouseholdProvider` calls `setHouseholdId()`
   **synchronously during render**, not in an effect, so the `X-Household-ID` request
   interceptor is populated before any descendant's first effect fires. That ordering is
   load-bearing — a deep link straight to `/financial/expenses` sends an unscoped request if
   you move that call into `useEffect`.

5. **The 401 interceptor has two deliberate exemptions.** It redirects to `/auth/login` only
   when the path does not already start with `/auth` **and** the failing request is not
   `/auth/session`. Without the second exemption the session probe on a logged-out visitor
   triggers a redirect loop.

6. **This repo authenticates with a password; the current spec says it should not.**
   `useLogin` posts `{ email, password }` to `/auth/login`. `notes/FE-App/prd-auth-fe.md`
   v3.1 (2026-08-27) specifies **passwordless magic links**, with passwords explicitly
   deferred to Phase 2. The code predates that PRD and has not been migrated.

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
| Primitives   | radix-ui (Dialog, Select)                 | ^1.6.7                |
| i18n         | @inlang/paraglide-js (devDependency)      | ^2.25.0               |
| Test         | Vitest 4 + @testing-library/react + MSW 2 | —                     |
| Mobile       | @capacitor/core                           | 8.4.2                 |

`@/` resolves to `src/`. Radix is used **only for behaviour** — focus trap, focus restoration,
Escape handling, listbox keyboard semantics — never for styling; every visual comes from the
tokens in §5.1. This also settles the vault's locked-stack row that named Radix/Headless UI.

Paraglide is a **devDependency**: it is a compiler, and only its generated output ships.

---

## 5. State ownership

| Kind of state                   | Owner                                                     |
| ------------------------------- | --------------------------------------------------------- |
| Server data                     | TanStack Query, keyed by household                        |
| Filters, sorting, pagination    | URL params (`useSearchParams`) via `useExpenseFilters`    |
| Settings scope (which group)    | URL hash — `/settings#akun` **is** the Household view     |
| Session (user, household, role) | `HouseholdContext`                                        |
| Theme, language                 | `SettingsContext` + `localStorage`; Paraglide owns locale |
| Local UI (open row, form open)  | `useState`                                                |

No Zustand, no Redux, no global store. This is the binding decision from the architecture
document and the code holds to it.

### 5.1 Design tokens and themes

Every colour in the app resolves through CSS custom properties in `src/styles/globals.css`.
**No component names a colour.** A theme is one token block there plus one entry in
`src/theme/themes.ts` — adding a fourth theme is a two-file change that touches no UI code.

Shipped themes: **Mawar** (soft rose, default), **Kobalt**, **Tegel Kunci**.

Rules that hold across every theme, and that a reviewer should enforce:

- `--danger` is reserved for destructive actions and is **never** a category rim.
- `--rim-1..8` are the category channel. Categories are user-created and unbounded, so
  assignment wraps at eight (`rimFor(order)` in `src/theme/rims.ts`); colours repeat past
  that, which degrades scanning without breaking meaning because the name is always present.
- Colour never carries meaning alone — every rim and every deviation marker has text beside it.
- Containers lift (`plate-shadow`, `lift-shadow`); data stays flat; inset (`well-shadow`) is
  reserved for input wells.

### 5.2 i18n

Indonesian is the base locale, English is complete and first-class. Strategy is
`['localStorage', 'preferredLanguage', 'baseLocale']`, so a new visitor gets their browser
language and a returning one gets their choice. `setLocale(..., { reload: false })` — a full
reload for a preference change would discard in-flight queries and scroll position.

**160 messages per locale.** No component may hold a literal user-facing string.

Tests pin the locale to `id` via `overwriteGetLocale` in `src/test/setup.ts`, because jsdom
reports `navigator.language` as `en-US` and assertions need one language to target.

---

## 6. Module layout

Sliced by **entity**, not by HTTP verb. `src/api/` is transport only; every
entity's key factory, reads and writes live in one file inside the module that
owns the write side. One endpoint → one query key → one response type.

```
src/
├── api/                   transport only — nothing entity-shaped lives here
│   ├── client.ts          axios instance + both interceptors
│   ├── keys.ts            household-rooted key helper: ['h', householdId, entity]
│   ├── queryClient.ts     staleTime 5m, gcTime 10m, retry 5xx only
│   └── useInvalidatingMutation.ts   a write plus the reads it makes stale
├── components/            ConfirmDialog, ErrorBoundary, FormField, Loading, Logo,
│   │                      Select, Layout/
│   └── Layout/            AuthLayout, DashboardLayout, Sidebar (+ BottomBar)
├── contexts/              HouseholdContext, SettingsContext (theme + language)
├── hooks/                 useCurrency
├── i18n/                  locales.ts, useMessages.ts
├── messages/              id.json, en.json  ← source of truth for copy (repo root)
├── mocks/
│   ├── db.ts              the ONLY mutable store + resetMockState + nextId
│   ├── fixtures/          pure seed functions, one file per context
│   └── handlers/          one file per context + index.ts barrel
├── modules/
│   ├── auth/              api/session.ts (session + login), signin/, types/auth.ts
│   ├── financial/         api/expenses.ts (keys + read + create + delete),
│   │                      components/, hooks/, pages/, types/
│   └── settings/          api/{categories,accounts,members,prefs}.ts,
│                          components/, lib/, pages/, types/, anchors.ts
├── paraglide/             GENERATED — do not edit, do not commit
├── pages/                 DashboardPage, ErrorPage, NotFoundPage
├── routes/                router, ProtectedRoute
├── theme/                 themes.ts, rims.ts
├── types/                 api.ts, catalog.ts (Category/Account), expense.ts, household.ts
└── utils/  test/
```

Type placement follows the same rule: cross-module domain types in `src/types/`,
module-scoped types in `src/modules/<module>/types/`, component `Props` local to
the component.

---

## 7. Routes

| Path                  | Element                                  | Guard            |
| --------------------- | ---------------------------------------- | ---------------- |
| `/auth/login`         | `LoginPage` inside `AuthLayout`          | none             |
| `/`                   | redirect → `/dashboard`                  | `ProtectedRoute` |
| `/dashboard`          | `DashboardPage` inside `DashboardLayout` | `ProtectedRoute` |
| `/financial/expenses` | `ExpensesPage` (lazy + `Suspense`)       | `ProtectedRoute` |
| `/settings`           | `SettingsPage` (lazy + `Suspense`)       | `ProtectedRoute` |
| `*`                   | `NotFoundPage`                           | none             |

Two lazy routes now. `ErrorPage` is the `errorElement` on both layout branches. **No route uses
`PermissionRoute`** — role is enforced inside components via `canManageExpenses(role)`.

**The settings scope lives in the URL hash**, not in state: `/settings#akun` _is_ the Household
view. Anchors are exported from `src/modules/settings/anchors.ts` with a `settingsHref()`
helper, so other modules link in by constant rather than a hand-typed string.

---

## 8. Auth, session and the app shell

`useSession()` GETs `/auth/session` and is the single source of session truth.
`HouseholdProvider` derives `user`, `household`, `householdId`, `role` (defaulting to
`'member'`), `isAuthenticated` and `isLoading` from it, and pushes `householdId` into the axios
module scope during render.

`ProtectedRoute` renders `Loading` while `isLoading`, redirects to `/auth/login` when not
authenticated, and otherwise renders children.

`DashboardLayout` is a **viewport-height shell that never scrolls**: `Sidebar` on the left
(`BottomBar` below `lg`), and a `<main>` whose page decides which of its own regions scroll.
That is what keeps the ledger's count strip and month rail fixed while only the tape moves —
`overflow` lives on one inner container per page, not on the document.

Login and logout both invalidate `SESSION_KEY` (`['auth', 'session']`) on success — logout's
hook exists but no UI calls it.

---

## 9. API contract and data fetching

Base URL `VITE_API_URL || '/api'`, `withCredentials: true`. Every request carries
`X-Household-ID` when a household id is known.

**Error envelope.** The real shape (auth PRD v3.1 §0) is
`{ success, status_code, error: { code, message } }`, so `getErrorMessage()` reads
`data.error.message` first and falls back to a flat `data.message` for endpoints still on the
older shape. `getErrorCode()` exposes the code for callers that branch on it. This matters most
on invite, where the three different 409s each say something different and the wording _is_ the
feature — a generic message would destroy it.

**Query keys.** Hierarchical and household-scoped:

```
EXPENSE_KEYS.all                        ['expenses']
EXPENSE_KEYS.byHousehold(hid)           [...all, hid]
EXPENSE_KEYS.lists(hid)                 [...byHousehold, 'list']
EXPENSE_KEYS.list(hid, filters)         [...byHousehold, 'list', filters ?? {}]
EXPENSE_KEYS.detail(hid, id)            [...byHousehold, 'detail', id]
SESSION_KEY                             ['auth', 'session']
SETTINGS_KEYS.categories|accounts|members|prefs(hid)
```

`EXPENSE_TYPE_KEYS`, `PAYMENT_SOURCE_KEYS` and `USER_KEYS` follow the same household-scoped
shape. Because `lists(hid)` is a strict prefix of `list(hid, filters)`, invalidating the former
correctly clears every filter permutation.

**List responses carry filter-scoped totals.** `GET /api/expenses` returns
`{ items, pagination, totals: { sum, count, average } }` (BE PRD §3.1). `totals` describes the
whole **filtered** set, not the page — which is why the count strip prints the period and
filters it is counting. A figure from `totals` without its scope stated is a confident lie the
moment anything is narrowed.

**Mutations.** `useCreateExpense` is the only one with an optimistic update (cancel → snapshot
→ `setQueryData` → rollback in `onError` → invalidate in `onSettled`). `useDeleteExpense` is
wired to the lifted plate's admin action. `useUpdateExpense` still has no caller. Settings
mutations each invalidate only their own list.

**Mock backend.** MSW starts in dev unless `VITE_ENABLE_MOCKS=false`, with
`onUnhandledRequest: 'bypass'`. **20 handlers** cover session/login/logout, expenses CRUD with
date/search/category/method/payer filtering, expense types, payment sources, users, and the
settings resources (categories, accounts, members incl. invite/resend/remove, household prefs).
`enableMocking()` uses `.finally()` so a mock-worker failure still boots the app rather than
leaving a blank page.

Seed data is **deterministic** (`mulberry32`, fixed seed): ~120 days of Indonesian household
spending plus four planted anomalies, so the ledger's baselines have something true to compute
from and every reload looks the same.

### 9.1 Endpoints the backend does not implement yet

The settings surface is built against paths that **do not exist server-side**. They work
locally because MSW answers them; they will 404 against the real API.

| Path                                                       | Used by                            |
| ---------------------------------------------------------- | ---------------------------------- |
| `POST/PUT /api/expense-types[/:id]`                        | category create / rename / archive |
| `POST/PUT /api/payment-sources[/:id]`                      | account create / edit / archive    |
| `GET/POST /api/households/:id/members`                     | members list, invite               |
| `POST /api/households/:id/members/:memberId/resend-invite` | resend                             |
| `DELETE /api/households/:id/members/:memberId`             | remove                             |
| `GET/PUT /api/households/:id/prefs`                        | currency, month start day          |

`expense-types` and `payment-sources` also now carry fields the BE contract does not define:
`order`, `archivedAt`, and on accounts `kind`, `openingBalance`, `asOf`. See §15.6.

---

## 10. Known defects and unwired code

> Companion documents: [`CODE-REVIEW-FINDINGS.md`](CODE-REVIEW-FINDINGS.md) is the full
> review this table summarises; [`REFACTOR-2026-08-31.md`](REFACTOR-2026-08-31.md) records
> what was fixed; [`API-GAP-ANALYSIS.md`](API-GAP-ANALYSIS.md) covers the FE↔BE contract,
> which is a separate axis from everything below.

| #   | Item                         | Detail                                                                                                                                                                                                                                |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Password auth vs. spec**   | Repo ships email+password; `prd-auth-fe.md` v3.1 mandates passwordless magic links                                                                                                                                                    |
| 2   | **Two routed login screens** | `/auth/login` is what every redirect targets; `/auth/signin` is designed but its `submitSignin` is a stub with no network call. Needs a decision, not a deletion                                                                      |
| 3   | `monthStartDay`              | Persisted by Settings and read nowhere — custom period boundaries are unimplemented                                                                                                                                                   |
| 4   | Fresh-clone build            | `src/paraglide` is generated and untracked, and the `postinstall` that generates it lives only in the gitignored `package.json.local`. CI passes because `npm run test` runs before `npm run build` and generates it as a side effect |
| 5   | Auth/error/loading screens   | `LoginForm`, `AuthLayout`, `Loading`, `NotFoundPage`, `ErrorPage`, `ErrorBoundary` use raw Tailwind palette classes and hardcoded English instead of design tokens and Paraglide                                                      |
| 6   | No logout                    | No sign-out control exists anywhere; the unused hook was removed rather than left as dead code                                                                                                                                        |
| 7   | No expense edit              | The inert Edit button and `useUpdateExpense` were removed. Restoring edit is a feature task                                                                                                                                           |

**Fixed since the last revision**, kept here so an audit does not re-raise them:

- ~~Create gated to admin.~~ The gate was removed; the matrix is create = member ✅ admin ✅,
  update/delete = admin only. `ExpenseForm.test.tsx` now asserts the specified behaviour
  rather than the bug.
- ~~`getErrorMessage` read the wrong error shape.~~ Now reads the real envelope (§9).
- ~~No modals of any kind.~~ `ConfirmDialog` (Radix) handles archive, remove and delete.
- ~~`useDeleteExpense` unwired.~~ Wired to the lifted plate, behind a confirmation.
- ~~`ExpenseTable` / `Navbar`.~~ Deleted — replaced by the tape and the sidebar.
- ~~Delete had no confirmation step.~~ It now confirms, removes optimistically, rolls back on
  failure, and surfaces the error.
- ~~Category and account edits never reached the expenses page.~~ `/expense-types` and
  `/payment-sources` were each read through two query keys and only one was invalidated.
  One key per endpoint now, with `useActiveCategories` / `useActiveAccounts` narrowing by
  `select` rather than by a second request.
- ~~`PermissionRoute`, `PermissionGuard`, `hasRole`, `canCreateExpenses`, `useLogout`,
  `useUpdateExpense`, `useExpense`, `getErrorCode`, `daysInRange`, both type barrels.~~
  Deleted — all had zero call sites.
- ~~Required Selects blocked submission with no message.~~ `Select` has an error slot; every
  rule in `ExpenseForm` renders where it applies.
- ~~`toISOString()` in the archive paths.~~ Replaced with `isoDay`, which reports the local day.

**Still missing against the Expenditure FE PRD:** `ExpenseCard`, `ExpenseRow`,
`DeleteConfirmModal` and `useExpenseActions` as named. The shipped ledger solves the same jobs
with a different structure (`ExpenseTape` + `ExpensePlate`, one responsive component instead of
a table/card split), and create is an inline panel rather than the modal the PRD specifies.
`ExpenseStats` is superseded by `CountStrip`.

---

## 11. Build and performance

```
dist/index.html                    2.22 kB │ gzip:   1.23 kB
dist/assets/index-*.css           33.39 kB │ gzip:   7.40 kB
dist/assets/ExpensesPage-*.js     24.21 kB │ gzip:   7.46 kB
dist/assets/SettingsPage-*.js     25.84 kB │ gzip:   7.12 kB
dist/assets/permissions-*.js      87.10 kB │ gzip:  30.03 kB
dist/assets/index-*.js           434.60 kB │ gzip: 140.96 kB
```

451 modules. Two lazy route chunks. The `permissions-*` chunk is Rollup naming a shared chunk
after one of its members — it carries Radix and shared module code, not just `permissions.ts`.
The main bundle carries React, Router, Query, RHF and axios.

---

## 12. Accessibility — real status

**What holds.** Form inputs use implicit labelling — `<label>` wraps its control. Field errors
carry `role="alert"`. `Loading` uses `role="status"` with `aria-live="polite"`. There is a skip
link in `DashboardLayout`. Dialogs (Radix) trap focus, restore it to the trigger, and close on
Escape. Selects (Radix) have full listbox keyboard semantics. Disclosure rows use
`aria-expanded` + `aria-controls`. Member status badges carry an `aria-label` spelling the
state out rather than relying on a glyph. Nav items and index buttons set `aria-current`.
`:focus-visible` is styled globally. `prefers-reduced-motion` is honoured.

**What does not.** Colour contrast has **never been audited** against 4.5:1 across all three
themes — the tokens were chosen to clear it, but nothing verifies that. There is no automated
a11y check in CI. The PRD asks for WCAG 2.1 AA; treat that as unproven, not achieved.

---

## 13. Testing, environment and deployment

**Tests.** 12 files / 30 tests, Vitest + jsdom, setup at `src/test/setup.ts`, MSW server for
node. Covered: axios client, session/expense queries, `useCreateExpense`, `useExpenseFilters`,
`HouseholdContext`, `ProtectedRoute`, `LoginForm`, `ExpenseForm` (incl. the future-date rule and
member-can-create), `MemberSection` (non-ASCII invite, verbatim 409, derived states, both
permission rules), formatters, permissions, mock handlers.

Not covered: routing composition, `ExpenseTape`/`ExpensePlate`, `MonthRail`, `CountStrip`,
`useItemBaselines`, `CategorySection`, `AccountSection`, `PreferencesSection`, the `Select`
component, error boundary.

**Two harness facts worth knowing.** Radix popups need Pointer Events shims that jsdom lacks
(`hasPointerCapture`, `setPointerCapture`, `releasePointerCapture`, `scrollIntoView`) — without
them a `Select` never opens and it looks exactly like a component bug. And a designed Select
must be driven the way a person drives it: `chooseOption()` in `src/test/test-utils.tsx` opens
the trigger first, because there is no `option` in the DOM until then.

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
apply. The dependency is exact-pinned; revisit when a patched release ships. The other two
current highs — `brace-expansion` via eslint, `nanoid` via vite/postcss — are build-chain only
and were not introduced by the Radix or Paraglide additions.

**Mobile.** `capacitor.config.ts` with `webDir: dist`. `/ios` and `/android` are gitignored and
must be generated locally (`npx cap add ios|android`), which needs Xcode + CocoaPods or Android
Studio + SDK.

---

## 14. Document map

The Nostos vault is the source of truth for product and architecture. It is symlinked at
`notes/` (→ `~/Documents/my-vault/Nostos`) and is **not** part of this repo. Never copy a vault
document into the repo — link to it. (This file currently violates that rule; see §15.8.)

| File                                   | What it is                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `README.md`                            | Orientation and setup                                                                                      |
| `docs/FRONTEND.md`                     | **This file** — authoritative technical record for this repo                                               |
| `PRODUCT.md`                           | Impeccable-managed product record: users, purpose, constraints, brand commitments                          |
| `docs/superpowers/plans/`              | Historical implementation plan                                                                             |
| `docs/superpowers/specs/`              | Design spec for the initial build                                                                          |
| `notes/NOSTOS-Master-Document.md`      | Master reference: stack, patterns, permissions, phases, decision log                                       |
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

`PRODUCT.md` is present at the repo root. `DESIGN.md` is **not** — the visual system is
currently recorded in `src/styles/globals.css` (tokens, §5.1) and in the direction contract
comment in `index.html`, not in an Impeccable-managed DESIGN.md.

---

## 15. Open items

1. **Decide the auth direction.** Either migrate to magic links per `prd-auth-fe.md` v3.1, or
   record in the vault that the app keeps passwords for Phase 1. The two currently disagree
   silently.
2. **Wire or delete** the six unused exports in §10. Dead permission code is worse than none —
   and `canCreateExpenses` is now dead code this repo created itself.
3. **Expense edit is missing** and `useUpdateExpense` is still unwired. **Delete has no
   confirmation** — `ConfirmDialog` already exists in settings and should be reused.
4. **Inline category add during capture.** The moment a category is discovered missing is
   mid-entry; sending the user to Settings breaks the sub-minute capture the product depends on.
5. **Account names are too long for ledger rows.** Renaming payment sources to real accounts
   ("Tunai — kotak dapur") made the row meta truncate. Needs a short display label on the
   account, falling back to the full name.
6. **The settings surface runs ahead of the backend.** Six endpoint groups and several new
   fields (§9.1) exist only in MSW. Either get them into the BE contract or mark the surface
   as mock-only before anyone demos it against a real API.
7. **Colour contrast is unverified** across three themes (§12). Worth an automated check in CI
   rather than a promise.
8. **This document exists twice** — here and at `notes/FE-App/FRONTEND.md`, byte-identical and
   hand-synced. §14 forbids copying vault documents into the repo, and two authoritative copies
   drift the moment someone updates one. Pick one home: either the repo file is canonical and
   the vault links to it, or the reverse.
9. **The auth v3.1 design record is cited by an unresolvable path.** Six vault documents cite
   `docs/superpowers/specs/2026-08-27-auth-nostos-alignment-design.md` as the authority that
   "wins any disagreement" for auth v3.1 — including `BE/BACKEND.md`, which sends a reader to
   its **§6.1** for the per-request `AuthGuard` lookup. The document is real (465 lines) but
   lives in the **be-app** repo at that repo-relative path, so the citation only resolves for
   someone standing in `be-app`. From this repo, from the console repo, and from inside the
   vault where all six citing documents actually live, it resolves to nothing. Fix by making
   the citations repo-qualified (`be-app/docs/…`) or by mirroring the spec into the vault
   alongside the PRDs that depend on it.
10. ~~`notes/MASTER_PRD_EXPENDITURE.md` lists "password reset" as an auth dependency.~~
    **Accepted, no action** — passwords are a known Phase 2 consideration, so the dependency
    line stands. Recorded here so a future audit does not re-raise it.
11. **Reconcile the locked-stack table** — the master document names React 18; this repo runs
    React 19. The Radix/Headless UI row is now satisfied: Radix is installed and used for
    behaviour only.
