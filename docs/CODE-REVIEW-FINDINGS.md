# Code review findings — `refactor/code`

**Reviewed:** the whole `src/` tree at `38cc51d` (root commit `c76a691` → `38cc51d`).
`refactor/code` had no diff against `main`, so the review scope was the full codebase, not a patch.

**Method:** four independent reviewers, each with a scoped mandate — data/API layer, type
and enum placement plus naming, dead-code reachability plus MSW organisation, and
component architecture plus correctness and tests. Every finding reproduced below was
re-verified against source before being recorded. Findings that did not survive
verification are listed in [§7](#7-findings-that-did-not-hold).

**Status legend:** ✅ fixed in this branch · 🟡 partially addressed · ⬜ open

---

## 1. Blocking defects

### 1.1 ⬜ The build does not survive a fresh clone

`src/paraglide/` is generated and **zero files are tracked** — `src/paraglide/.gitignore`
contains `*`, which is why commit `aac48a5` ("allow paraglide from gitignored") had no
effect: the nested ignore wins over the root one.

The `postinstall` that generates it exists only in **`package.json.local`, which is
gitignored** (`*.local`):

```
$ diff package.json package.json.local
>     "i18n:compile": "node scripts/compile-i18n.js",
>     "postinstall": "npm run i18n:compile",
```

`tsc -b` on a clean checkout fails with 8 errors (`Cannot find module
'@/paraglide/runtime.js'` × 4, `'@/paraglide/messages.js'` × 2, plus two implicit-`any`
errors that only surface once the module is missing).

CI (`npm ci → lint → test → build`) passes **only because `npm run test` runs first** and
vitest booting `vite.config.ts` generates the directory as a side effect. `npm ci && npm
run build` — the standard deploy sequence — fails today.

This is the root cause behind commits `62e4fd7` → `ae226cc` → `aac48a5` → `7977dca`.
Removing `type-check` from the PR pipeline treated the symptom.

**Related:** `paraglide.config.js` documents itself as the shared source of truth _"so they
cannot drift"_, but `vite.config.ts:8` has that import **commented out** and inlines a
duplicate copy of the options. The drift it warns about already exists.

**Fix:** move the two lines into the committed `package.json`, delete `package.json.local`,
restore `type-check` to `ci.yml`, and un-comment the shared config import in
`vite.config.ts`.

_Left open at the maintainer's instruction._

### 1.2 ✅ Category and account edits never reached the expenses page

`/expense-types` was read through **two different query keys**:

| Hook                                                | Key                      | staleTime      | Invalidated by                           |
| --------------------------------------------------- | ------------------------ | -------------- | ---------------------------------------- |
| `useExpenseTypes` (`api/queries/expenseTypes.ts:6`) | `['expense-types', hid]` | **`Infinity`** | nothing                                  |
| `useCategories` (`api/queries/settings.ts:14`)      | `['categories', hid]`    | default        | `useCreateCategory`, `useUpdateCategory` |

`ExpenseForm`, `ExpenseFilter` and `ExpensesPage` all consumed the first. Renaming a
category in Settings left the expense form dropdown, the filter and the ledger labels
showing the old value **for the entire session**, because `staleTime: Infinity` means that
key never refetches. Archived categories stayed selectable indefinitely. Deterministic,
not a race.

Identical bug on `/payment-sources` (`paymentSources.ts:6` vs `settings.ts:15`). A third,
milder instance on `/users` vs `/members` — less severe only because `users` used the
default 5-minute staleTime and self-healed.

Three of the four reviewers arrived at this independently, from different directions.

### 1.3 ✅ The expense form silently refused to submit

`src/components/Select.tsx` had **no `error` field** on its `Props` and never rendered one.
But `ExpenseForm.tsx:108,129,149` attached `rules={{ required: m.form_err_category() }}` to
`Controller`s wrapping `Select`. Those messages landed in `formState.errors` and were
displayed nowhere.

Reproduced against the real component: name + amount + method filled, category forgotten,
click Catat → **zero alerts in the DOM, submission blocked**. The button reads as broken.
`paidByUserId` was worse — `rules={{ required: true }}` with no message at all.

Same failure class in `MemberSection.tsx:56-59`: a blank email blocked the invite with
nothing said, because `emailError` was only computed when `email.length > 0`.

### 1.4 ✅ Archive timestamps were misdated for the entire target audience

`AccountSection.tsx:228` and `CategorySection.tsx:186` both used
`new Date().toISOString().slice(0, 10)` — while `utils/dates.ts:1` states the rule:
_"never `toISOString()`, which shifts the day backwards for anyone east of UTC, which is
everyone here."_

Archive at 00:30 Jakarta (UTC+7) → `archivedAt` recorded as the previous day. Every archive
in the first seven hours of each local day was wrong. `isoDay` was already imported in
`AccountSection.tsx:17`.

### 1.5 ✅ Deleting a money record was one unconfirmed tap that failed silently

- `ExpensePlate.tsx:255-261` — a bare delete button, no `ConfirmDialog`. The settings module
  already stops for the _less_ destructive archive.
- `ExpensesPage.tsx:261` — `onDelete={(expense) => deleteExpense(expense.id)}`; the returned
  `error`/`isError` were never destructured.
- `useDeleteExpense.ts:11-15` — `onSuccess` only. No `onError`, no optimistic removal, no
  rollback.

A failed DELETE (500, 403, offline) produced no toast, no row change, no console signal.
The user taps delete, the row stays, they tap again.

---

## 2. Architecture

### 2.1 ✅ `queries/` + `mutations/` sliced by the wrong axis

The split was by **HTTP verb kind**, a technical detail no caller thinks in. Three
concrete costs, all already visible at _four_ entities:

1. **It had already collapsed.** `api/queries/settings.ts:70-128` contained **eight
   mutations** inside the `queries/` folder. The convention lasted one feature.
2. **It hid drift.** `useCreateExpense` had full optimistic updates with rollback;
   `useUpdateExpense` and `useDeleteExpense` had a bare `onSuccess: invalidate`. Three
   files that never appeared on screen together, written to three different standards.
3. **It scattered the key.** `EXPENSE_KEYS` lived in `queries/` and was imported by every
   file in `mutations/`. The folder boundary was crossed on every write — proof the
   boundary was in the wrong place. §1.2 is literally _"a mutation invalidated a key it
   could not see."_

**Three conventions coexisted:** verb-layered global (`api/queries/*`),
verb-layered-but-violated (`queries/settings.ts`), and module-local vertical
(`modules/auth/api/useLogin.ts`).

### 2.2 ✅ Optimistic create wrote into caches the row did not belong to

`useCreateExpense.ts:25-38` prepended to _every_ key matching `['expenses', hid, 'list']`,
ignoring each cache's filters:

- `CountStrip.tsx:40-46` holds a **previous-month** list cache — a new expense dated today
  was injected into it.
- `CategorySection.tsx:36-41` holds a 1000-row cache on the Settings page; `usageOf` then
  over-counted.
- With a category or search filter active, a new expense in a _different_ category appeared
  at the top of the tape until `onSettled` landed.

It also bumped `pagination.total` but left `totals` untouched, so the tape gained a row
while the header total sat still — half-done is worse than neither.

### 2.3 ✅ Optimistic id was neither unique nor inert

`useCreateExpense.ts:21` — `` `optimistic-${input.name}-${input.datePaid}` ``. Two in-flight
creates with the same name and date produced duplicate `key={expense.id}` at
`ExpenseTape.tsx:93` (React reconciliation corruption) and a shared `openId`. The row also
rendered a live delete button wired to the fake id, whose failure was swallowed by §1.5.

### 2.4 ✅ `retry: 2` applied to 4xx

`queryClient.ts:9`. A 403 or 404 was retried twice with backoff before failing. Worse for
401: the interceptor fires the redirect on the _first_ rejection, then two more doomed
requests go out during unload.

### 2.5 ✅ Mutation errors were discarded at seven call sites

Only three places called `getErrorMessage`. Dropped everywhere else — most notably
`MemberSection.tsx:38-39`, where the mock deliberately returns a bespoke 409
(`handlers.ts:220-231`) whose comment says the wording _"is the whole feature"_, and the UI
threw it away. Root cause was `useListMutation` (`settings.ts:59-68`) wiring only
`onSuccess` and giving callers no ergonomic error channel.

### 2.6 ✅ Free-text search had no debounce

`ExpenseFilter.tsx:41-43` called `onChange` per keystroke → URL rewrite → new `filters`
object → new query key → a fresh request **and a fresh 5-minute cache entry per
character**. Typing "groceries" cost 9 of each.

### 2.7 ⬜ Household id has two independent sources of truth

`client.ts:3` holds it in module scope; `HouseholdContext.tsx:28` writes it during render.
The same id is also baked into every query key. For endpoints that do not carry the
household in the URL, the key can say household A while the header says whatever the global
last held. Latent today (no household switcher), but the moment one ships, a background
refetch of a household-A query will send the household-B header and write B's data under
A's key.

Mutating a module global during render is also a React purity violation that concurrent
rendering is entitled to break. The comment at `HouseholdContext.tsx:25-28` explains the
motivation — a deep link firing its first request before an effect runs — and the race it
solves is real; the mechanism is what is fragile.

### 2.8 ⬜ No global error handler on the QueryClient

No `QueryCache`/`MutationCache` `onError`. There is no single place to log, toast, or
capture a request id — which is why §2.5 was spread across seven components instead of
solved once.

---

## 3. Types and enums

### 3.1 ✅ `src/types/settings.ts` was neither types-only nor global

It held four runtime exports (`RIM_COUNT`, `memberStatus`, `MAX_RESENDS`, `isAsciiEmail`,
`rimFor`) alongside eleven types. Mechanical consequence: `src/types/index.ts` used
`export type *`, so it **could not** re-export any of them. `Category`/`Account`/`Member`/
`*Input` were settings-module domain sitting in the global types folder.

### 3.2 ✅ Both type barrels were dead

`grep "from '@/types'"` → **zero hits**. `grep "from '@/api/types'"` → **zero hits**. All
30 consumers deep-imported. `src/types/index.ts` also silently omitted `settings.ts`, so
even a correct user would have got an incomplete surface. `src/api/types.ts` was a second,
competing barrel for the same three types.

### 3.3 ✅ `isAsciiEmail` was defined twice, byte-identically

`types/settings.ts:95-98` and `auth/signin/machine.ts:34-37` — same body, same
`// eslint-disable-next-line no-control-regex`, same doc comment. `MemberSection` imported
one copy; `SigninCard` the other. The rule would have drifted the first time punycode
support landed.

### 3.4 ✅ Rim derivation disagreed with itself three ways

- `rimFor(order)` over 8 rims — `CategorySection.tsx:120` (uses `category.order`),
  `AccountSection.tsx:170`, `ExpenseFilter.tsx:59` (uses **array index**),
  `ExpenseForm.tsx:119` (array index).
- `rimOf(typeId)` over 4 rims — `ExpensesPage.tsx:136-139`, typed inline as `1|2|3|4`,
  backed by a separate `RIMS` const.

With a fifth category, the ledger row and the filter dropdown showed **different colours
for the same category**. Worse: the mock filtered archived rows out of
`GET /expense-types`, so after any archive, index-based and order-based rims diverged for
every row after the gap.

`RIM_CLASS` was triplicated (`Select.tsx:24`, `SettingPlate.tsx:5`, `ExpensePlate.tsx:29`)
and the third copy had only 4 entries and no type annotation, which is what permitted the
divergence.

### 3.5 ✅ Module-scoped view types lived in leaf components

| Type                                              | Declared in                 | Imported by                           |
| ------------------------------------------------- | --------------------------- | ------------------------------------- |
| `DayGroup`                                        | `ExpenseTape.tsx:12`        | `ExpensesPage.tsx:13`                 |
| `DayTotal`                                        | `MonthRail.tsx:6`           | `ExpensesPage.tsx:14`                 |
| `Baseline`, `Verdict`                             | `useItemBaselines.ts:33,44` | `ExpensePlate.tsx`, `ExpenseTape.tsx` |
| `SigninErrorKind`, `SigninState`, `LandingReason` | `machine.ts:16,19,25`       | `SigninCard.tsx`, `scenes.tsx`        |

`ExpensesPage` importing a _page-level_ view model out of a leaf component inverts the
dependency direction: the page builds `groups` and `days` and hands them down, so the
contract belongs above both.

### 3.6 ✅ Convention asymmetry across modules

`src/modules/auth/types/auth.ts` existed but held a single 4-line interface, while four
auth types sat in `signin/machine.ts`. `financial/` and `settings/` had no `types/` folder
at all. The one module that established the convention did not follow it.

### 3.7 ✅ Unsafe cast that fabricated a guarantee

`useExpenseFilters.ts:37`:

```ts
sortOrder: (params.get('order') as 'asc' | 'desc' | null) ?? 'desc',
```

`?order=bogus` yielded the string `'bogus'` typed as `'asc' | 'desc'`, which went straight
into an axios `params` object. `?limit=abc` yielded `NaN` and shipped `limit=NaN` on the
wire. The only place in the codebase where a cast invented a fact.

### 3.8 ✅ `sortBy: string` was unmodelled

`types/expense.ts:47`. Every call site passed `'datePaid'`. The clearest case of a
string-literal union that wanted a name.

### 3.9 ✅ `SETTINGS_ANCHORS` was bypassed at every definition site

`anchors.ts:5-10` declared the const-object-as-enum and `Sidebar.tsx:119` consumed it
correctly — but the four sections that _own_ those anchors hardcoded the literals
(`id="kategori-pengeluaran"`, `id="akun"`, `id="anggota"`, `id="rumah"`). They matched by
coincidence with no compiler link holding them there.

### 3.10 🟡 Unguarded casts where a guard already existed

`PreferencesSection.tsx:87` `value as ThemeId` while `isThemeId` sat unused at
`themes.ts:17`; `:97` `value as Lang`; `AccountSection.tsx:28,71` `as AccountKind`.

Three of the four are now guarded. `AccountKind` still casts from a native `<select>`
value — making `Select` generic over `T extends string` would remove the last one.

---

## 4. Dead code

Seven fully dead files, all grep-proven at zero call sites, none with tests attached:

```
src/utils/validators.ts              src/routes/PermissionRoute.tsx
src/types/index.ts                   src/api/mutations/useUpdateExpense.ts
src/api/types.ts                     src/modules/auth/api/useLogout.ts
src/components/PermissionGuard.tsx
```

Dead symbols inside live files: `useExpense` (and no MSW handler existed for
`GET /expenses/:id`), `StillLifeScene` + `LedgerScene` (124 lines, kept alive only by two
commented-out returns in `SigninPage.tsx:14-15`), `canCreateExpenses` (which was
`() => true`), `hasRole`, `daysInRange`, `getErrorCode`, `MOCK_SOURCES`, `isNonEmpty`,
`isPositiveNumber`.

Also: 13 unused i18n keys × 2 locales, a dead `VITE_APP_NAME`, and an **inert Edit button**
on the lifted plate — `ExpensePlate.tsx` rendered it whenever `canManage`, but no `onEdit`
was ever passed, so clicking it did nothing.

### 4.1 ⬜ Two complete login implementations, both routed

Not a deletion — an unresolved fork.

- `/auth/signin` → the designed magic-link screen. **Nothing links to it**
  (`grep "auth/signin"` → only the route definition), and `machine.ts:56-61` `submitSignin`
  is a 600 ms `setTimeout` returning `{ok:true}` with no network call. It cannot
  authenticate anyone.
- `/auth/login` → the pre-design scaffold. **Every redirect targets this**
  (`ProtectedRoute.tsx:9`, `client.ts:43`). It hardcodes English strings and raw
  `bg-gray-50` Tailwind instead of the design tokens the rest of the app uses.

The screen users reach is the throwaway; the polished one is a stub. The route comment
admits it: _"the magic-link screen lives alongside the password login so dev sign-in keeps
working. Making it the default is an integration task."_

See [`API-GAP-ANALYSIS.md` §5](API-GAP-ANALYSIS.md#5-auth-the-deepest-gap) — the real API is
passwordless-only, so `/auth/login` has no server to talk to either.

### 4.2 ✅ Personal state committed to the repo

`notes -> /Users/<user>/Documents/my-vault/Nostos` was a **tracked symlink** to a personal
absolute path — broken on every other machine and in CI, and it leaked the author's
filesystem layout into public history. `.impeccable/live/config.json` (design-tool state)
was tracked too.

### 4.3 ⬜ `@capacitor/core` is unused in `src/` — correctly

Flagged by a reviewer as an unused runtime dependency. **Not removed:**
`@capacitor/ios`/`android` peer-depend on it and the native runtime needs it in the bundle.
Removing it would break `cap sync`. Recorded here so a future audit does not re-raise it.

---

## 5. MSW mock layer

### 5.1 ✅ One flat 256-line file, seven domains, twenty handlers

`src/mocks/handlers.ts` mixed auth, expenses, expense types, payment sources, members,
prefs and users. `src/mocks/data.ts` was a 417-line fixture file with the mutable store
appended to the bottom.

### 5.2 ✅ Ascending sort was silently impossible

`expenses.ts:21-23` shipped the internal filter object straight to axios, so the wire name
was `sortOrder` (`types/expense.ts:48`). `handlers.ts:84` read `params.get('order')` — the
_browser URL_ name from `useExpenseFilters.ts:16`. Always `null`, always took the `desc`
branch. `sortBy` was sent and ignored entirely.

This is precisely the class of bug MSW exists to catch, and here the mock _hid_ it. Anyone
building an ascending-sort control would have seen it "work" and shipped a no-op.

### 5.3 ✅ Restore could never render

`handlers.ts:121` and `:146` both `.filter(c => !c.archivedAt)` on the GET. But
`CategorySection.tsx:157-161` renders `onRestore` only _when_ `archivedAt` is set. Archive
something → it vanished from the list → the restore button it was supposed to grow was
permanently unreachable. Three UI branches (`muted`, the archived badge, `onRestore`) and
the `act_restore` / `cat_archived` message keys were dead by construction.

### 5.4 ✅ `Date.now()` as an id generator

`handlers.ts:127,152,200`. Collides within a millisecond, and `resetMockState` had no way
to reset it — so ids differed between runs. `data.ts:406` already had the right pattern
(`nextExpenseId`) two hundred lines away.

### 5.5 ✅ Error envelopes were inconsistent

`types/api.ts` documents the real shape and `utils/errors.ts` reads `data.error.message`
first — but only the member handlers honoured it. Five other failure paths returned
`new HttpResponse(null, { status: 404 })`, so `getErrorMessage` fell through to axios's
generic `"Request failed with status code 404"` and no error copy was testable.

### 5.6 ✅ No latency simulation anywhere

`delay()` was never imported. Every mock resolved synchronously, so the `isLoading`
branches in `ExpensesPage`, `SectionShell`, `ProtectedRoute` and `AuthLayout` flashed or
never rendered in dev. Loading states written but never seen are loading states that rot.

### 5.7 ✅ `handlers.test.ts` tested the mocks

Two cases. The first asserted `items.length > 0` and `items[0].householdId ===
'household-001'` — both restatements of the fixture, and both already covered through the
real hook in `expenses.test.tsx`. The second proved `server.use()` composes with the axios
instance, which the same file also exercises. Deleted.

### 5.8 ⬜ No handler reads `X-Household-ID`

The client sets it on every request and every query key is tenant-scoped, but no mock
asserts it — so the mock layer cannot catch a cross-tenant leak. Low priority with one
seeded household; worth a `tenantOf(request)` helper when a second one appears.

---

## 6. Components, correctness, a11y

### 6.1 ✅ Stale `scrolledDate` corrupted the cumulative total

`ExpensesPage.tsx:44,78,81-89`. `scrolledDate` was never reset when filters changed.
`activeDate = scrolledDate ?? days[0]?.date`, and `cumulative` looped all groups breaking
only on `group.date === activeDate`. Scroll to mid-month, then apply a filter excluding
that day: `activeDate` named a date not present in `groups`, the loop never broke, and
`cumulative` became the **entire filtered total** while `MonthRail.tsx:135-142` still
printed "up to \<the stale date\>". The rail also highlighted nothing.

### 6.2 ✅ `AccountSection` shared one draft between two open forms

`AccountSection.tsx:47` held a single `draft`, and `fields()` was called both inside the
`adding` block and inside each open account row. Click "+ Tambah", type a name, then expand
an existing account → the row's `onToggle` overwrote `draft` with that account's values,
**silently wiping what was typed** while both forms remained on screen bound to the same
state.

### 6.3 ✅ O(rows × 1000) per render

`useItemBaselines.recentFor` ran a full `.filter()` over up to 1000 fetched expenses, and
`ExpenseTape.tsx:104` called it **once per row**. Neither `judge` nor `recentFor` was
memoised and `ExpensePlate` was not `React.memo`, so toggling a single row open re-rendered
the whole tape and redid ~200,000 iterations. `CategorySection.tsx:49-50` had the same
shape (`usageOf` filtering 1000 items per category, and twice more per dialog).

### 6.4 ✅ Accessible names polluted by error text

`ExpenseForm.tsx:205-215` and `parts.tsx:15-25` wrapped the input in a `<label>` _and_
rendered the error inside it, so once an error showed, the input's accessible name became
"Jumlah Harus lebih dari nol".

### 6.5 ✅ `SigninCard` resend flashed the user back to the form

`SigninCard.tsx:107` called `send(...)`, whose first act was `setState({ kind: 'sending' })`
— which exited the `state.kind === 'sent'` branch and re-rendered the email form. Clicking
"Kirim ulang" made the confirmation screen vanish and reappear.

### 6.6 ✅ `ExpensePlate` sparkline recomputed its peak per bar, and could emit `NaN`

`peak` was computed inside `recent.map()` (O(n²)), and if `expense.value` and all recent
values were 0, `item.value / peak` was `NaN` → `height: NaN%`.

### 6.7 ✅ A translated string used as a React key

`Sidebar.tsx:104` — `key={item.label()}`. Switching language unmounted and remounted every
planned-module item.

### 6.8 ✅ `m` shadowed in one file

Module-scope `import { m } from '@/paraglide/messages.js'` (used by the `LIVE`/`PLANNED`
tables) shadowed by `const m = useMessages()` at `:69`. Two different `m` in one file, one
reactive and one not — exactly the trap `useMessages`'s own doc comment warns about.

### 6.9 ✅ `PermissionRoute`/`PermissionGuard` role logic was inverted

Both used exact equality, so an **admin would be redirected away** from a route requiring
`'member'`. `permissions.test.ts` only tested the passing direction. Dead code, so
harmless — but shipping unused, incorrect guards invites misuse. Deleted rather than fixed.

### 6.10 ⬜ Currency and month-start were write-only settings

`PreferencesSection.tsx:54-71` let an admin pick both and persisted them, but all 11
`formatCurrency` call sites hardcoded `'IDR'` and `monthStartDay` was read nowhere.
A household selecting USD still saw Rp everywhere.

**Currency is now wired** through `useCurrency()`. **`monthStartDay` is still write-only** —
implementing custom period boundaries changes `monthRange` semantics and the default filter
range, which is feature work rather than refactoring.

### 6.11 ⬜ Auth, error and loading screens are outside both design systems

`LoginForm`, `AuthLayout`, `Loading`, `NotFoundPage`, `ErrorPage`, `ErrorBoundary` and
`DashboardLayout:19` use raw Tailwind palette classes (`bg-gray-50`, `bg-white`,
`border-gray-300`, `text-blue-600`, `text-red-600`) instead of the design tokens
(`bg-card`, `text-muted`, `border-hair`) every other component uses, and carry **14
hardcoded English strings** against 190 translated keys — in an app whose `baseLocale` is
`id`. With three themes registered, the login screen and every error state render off-theme.

Left together with §4.1, since which of them survives depends on that decision.

### 6.12 ⬜ `ErrorBoundary` has no reset path and sits outside the router

`App.tsx:12` mounts it outside `RouterProvider`, so a trip blanks the whole app including
providers, and the only recovery is a manual reload.

### 6.13 ⬜ `ProtectedRoute` loses the attempted destination

`ProtectedRoute.tsx:9` has no `state={{ from: location }}` and no `?redirect=`, so a deep
link to `/financial/expenses` is lost after signing in. `client.ts:43`'s hard
`window.location.assign` discards the router and cache as well.

---

## 7. Findings that did not hold

Recorded so they are not re-raised.

### 7.1 "The `SettingsPage` scroll-spy never activates when data loads slowly"

**Does not reproduce.** The claim was that the `IntersectionObserver` effect depends only on
`[activeGroup]`, and `root.querySelector` finds nothing on first run because `SectionShell`
gates its children on `!isLoading`.

`SectionShell` renders `<section id={id}>` **unconditionally** (`parts.tsx:106`) — only
`children` are gated. The anchor nodes therefore exist as soon as the section mounts, well
before the effect runs.

The observer was still re-keyed on section **ids** rather than group index as part of the
refactor, because a locale switch rebuilds every label and was needlessly tearing the
observer down. That is an improvement, not a bug fix.

### 7.2 "`@capacitor/core` is an unused dependency"

Unused in `src/`, but required by the native runtime. See §4.3.

---

## 8. What was genuinely good

Worth recording, because the density above is not the whole picture.

- **`EXPENSE_KEYS`** (`queries/expenses.ts:5-15`) was a proper hierarchical factory built by
  spreading its own parents, so prefix-invalidation actually worked. It is the pattern the
  rest of the repo should have copied — and now does.
- **The `useCreateExpense` optimistic block** was mechanically correct: `cancelQueries`
  before snapshot, snapshot via `getQueriesData`, full rollback, `onSettled` invalidating
  broader than it wrote. `useCreateExpense.test.tsx:71-75` locked in the real regression
  fixed by `5cb65dc`.
- **The 401 interceptor** correctly excluded the anonymous session probe, with a test that
  swaps `window.location` in jsdom to prove it.
- **Auth storage is right**: `withCredentials`, no token in `localStorage` (the only
  `localStorage` use is the theme, wrapped in try/catch for private mode), no
  `dangerouslySetInnerHTML`/`innerHTML`/`eval` anywhere, no secrets in `.env.example`.
- **Zero `any` in the entire codebase.** One non-null assertion, on `getElementById('root')`.
- **`ConfirmDialog`** delegates focus trap, Escape and focus restoration to Radix instead of
  hand-rolling them; `SigninCard` moves focus to the sent-heading because the form it
  replaced no longer exists.
- **`utils/dates.ts`** avoids the `toISOString()` UTC-shift trap deliberately and says why.
- **`useItemBaselines`** keys baselines on the item _name_ rather than the category, with an
  explicit "say nothing without a sample" rule — genuinely considered product logic, not a
  stub.
- **Comments explain invariants, not syntax** — `types/expense.ts:57` (totals are
  filter-scoped), `types/settings.ts:44` (member status is derived), `HouseholdContext.tsx:25`
  (why the write happens during render), `test/setup.ts:20` ("which looks like a component
  bug and is not one").
- **`test-utils.tsx`** builds a fresh `QueryClient` per render, so cache isolation between
  tests is structural rather than cleanup-dependent, and `setup.ts` uses
  `onUnhandledRequest: 'error'`.
- **Perfect en/id key parity**, zero `console.log`, zero `TODO`/`FIXME`, zero unused props.

---

## 9. Open items, in priority order

| #   | Item                                                                | Section |
| --- | ------------------------------------------------------------------- | ------- |
| 1   | Fresh-clone build / paraglide postinstall / restore CI type-check   | §1.1    |
| 2   | Decide `/auth/signin` vs `/auth/login`                              | §4.1    |
| 3   | Bring auth, error and loading screens onto tokens + Paraglide       | §6.11   |
| 4   | Household id single source of truth (before any household switcher) | §2.7    |
| 5   | Global QueryClient error handler                                    | §2.8    |
| 6   | `monthStartDay` — implement or remove the control                   | §6.10   |
| 7   | `ErrorBoundary` reset path, inside the router                       | §6.12   |
| 8   | Preserve the attempted destination through sign-in                  | §6.13   |
| 9   | `X-Household-ID` assertion in the mock layer                        | §5.8    |
| 10  | Generic `Select<T>` to remove the last unguarded cast               | §3.10   |

Everything above the line in §1–§6 marked ✅ is done and covered by
[`REFACTOR-2026-08-31.md`](REFACTOR-2026-08-31.md).
The FE↔BE contract gaps are a separate axis entirely — see
[`API-GAP-ANALYSIS.md`](API-GAP-ANALYSIS.md).
