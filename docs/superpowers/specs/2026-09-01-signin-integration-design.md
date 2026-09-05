# Signin Integration — Design

**Date:** 2026-09-01
**Status:** Approved (design), pending implementation plan
**Branch:** `feat/integrate-login`
**Source docs:** `notes/FE-App/prd-auth-fe.md` v3.1, `notes/BE/BACKEND.md`,
`notes/Postman/nostos-api.postman_collection.json`, `PRODUCT.md`

## 1. Goal

Wire the shipped signin UI to the shipped v1 auth API, and build the one signin
state that is not inline text: the household-deletion modal.

The UI exists (`/auth/signin` → `SigninPage` → `DoorScene` → `SigninCard`) with a
deliberate stub seam (`submitSignin`) that fakes 401 and 429 locally. The API
exists at `/api/v1/auth/*`. This spec replaces the stub with the real endpoints,
reshapes session state around `GET /auth/me`, moves the page to the route the
backend actually redirects to, and removes the legacy password login.

**In scope:** request a signin link, the sent/resend states, the redirect
landings, `/auth/me` as session source of truth, logout (the hook plus a desktop
sign-out control), and the deletion modal.

**Out of scope, deferred to their own specs:** invite acceptance, admin claim,
change-email confirmation, leave-household, the dashboard deletion banner, and
migrating the expenses/settings/members endpoints off MSW.

## 2. Starting Point

| Area             | Today                                     | Reality                               |
| ---------------- | ----------------------------------------- | ------------------------------------- |
| Route            | `/auth/signin`                            | backend redirects to `APP_URL/signin` |
| Base URL         | `/api`                                    | `/api/v1`                             |
| Session          | `GET /auth/session` → `{user, household}` | `GET /auth/me` → flat, snake_case     |
| Role             | `'admin' \| 'member'`                     | `'ADMIN' \| 'MEMBER'`                 |
| Signin call      | `submitSignin` stub                       | `POST /api/v1/auth/signin`            |
| Landings handled | `invalid_link`, `session_ended`           | five distinct cases                   |
| Login            | `POST /auth/login` + password form        | no password endpoint exists in v1     |

`VITE_API_URL` is already set to `http://localhost:3073`.

## 3. Decisions

| Topic                         | Decision                                        | Reason                                                                                                                                                                                                                            |
| ----------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                         | Signin loop **+ deletion modal**                | The 403 is one of four documented responses to `POST /auth/signin`; shipping without it mishandles a real API response                                                                                                            |
| Canonical route               | **`/signin`**                                   | Backend hardcodes `/signin` onto `APP_URL`, which is an origin (it doubles as a CORS origin)                                                                                                                                      |
| Legacy routes                 | **Removed**, not redirected                     | User decision; `/auth/login` can never work against v1                                                                                                                                                                            |
| Session shape                 | **Wire shape verbatim, snake_case**             | Per-module camelCase mapping happens when each module integrates; no mapper invented for one endpoint                                                                                                                             |
| Enum idiom                    | **`as const` object + derived union**           | `tsconfig.app.json` sets `erasableSyntaxOnly: true`, which makes TS `enum` a compile error. Const objects give `Role.ADMIN` typo protection and stay erasable. Repo already uses this in `theme/themes.ts`, `settings/anchors.ts` |
| Enum values                   | **Server casing preserved** (`ADMIN`)           | Re-casing creates a two-way mapping to maintain and breaks eyeball-matching against the network tab                                                                                                                               |
| Signin call                   | **TanStack `useMutation`**                      | Every server write in this app is already a mutation hook; PRODUCT.md names TanStack Query the owner of server data. `mutation.variables`/`reset()` cover most state, leaving one local counter                                   |
| Not `useInvalidatingMutation` | Plain `useMutation`                             | Signin makes no read stale; that helper is for writes with dependent queries                                                                                                                                                      |
| Mock coexistence              | One client, `*/api/v1/…` wildcard handler paths | Auth is shipped, the rest is not; wildcards avoid coupling mocks to the env origin                                                                                                                                                |
| Auth mocks                    | **Kept, unregistered**                          | Re-enabled via `VITE_MOCK_AUTH`; used per-test via `server.use(...)` so they stay exercised                                                                                                                                       |
| Modal primitive               | Radix **`Dialog`** with `role="alertdialog"`    | `AlertDialog` suppresses outside-click dismissal by design; PRD §2 requires backdrop dismiss                                                                                                                                      |

**Cookies work cross-origin in dev.** `localhost:5173` and `localhost:3073` are
different origins but the same _site_ — ports are not part of a site, and cookies
ignore ports entirely — so the backend's `SameSite=Lax` session cookie is sent on
XHR from the app. Requires only that the backend's CORS `APP_URL` is
`http://localhost:5173` with `credentials: true`, which `BACKEND.md` §8 confirms.
No dev proxy needed.

## 4. The Network Boundary

**`src/api/client.ts`**

- `baseURL` becomes `` `${import.meta.env.VITE_API_URL ?? ''}/api/v1` ``.
- Every v1 response is `{success, data, message}`. A small `unwrap<T>(res)` helper
  in this same file returns `res.data.data`. Auth calls use it; still-mocked
  endpoints return bare bodies and do not, until their own migration.
- **The 401 interceptor is rewritten.** It currently decides by
  `window.location.pathname.startsWith('/auth')`, which breaks twice: `/signin`
  no longer starts with `/auth`, and `POST /api/v1/auth/signin` legitimately
  answers 401 for "not invited". New rule: exempt by **request URL** —
  `/auth/signin`, `/auth/me`, `/auth/logout` never trigger a redirect. Any other
  401 imports the `queryClient` singleton from `@/api/queryClient`, calls
  `.clear()`, and then `window.location.assign('/signin?error=session_ended')`.
  A full page assign rather than router navigation, because the interceptor runs
  outside React and has no access to `useNavigate`. No import cycle:
  `queryClient.ts` imports axios directly, not `client.ts`.

`utils/errors.ts` already reads the real envelope (`data.error.message`) and needs
no change.

## 5. Types

**`src/types/household.ts`**

```ts
export const Role = { ADMIN: 'ADMIN', MEMBER: 'MEMBER' } as const
export type Role = (typeof Role)[keyof typeof Role]

export const HouseholdStatus = {
  ACTIVE: 'ACTIVE',
  DELETION_PENDING: 'DELETION_PENDING',
} as const
export type HouseholdStatus =
  (typeof HouseholdStatus)[keyof typeof HouseholdStatus]

/** GET /auth/me, exactly as the wire sends it. */
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

- `Session` and `Household` are deleted.
- **`User` survives.** It is the type of the `/users` attribution roster, which is
  mock-only and unshipped, consumed by `useUsers`, `ExpenseFilter`, `ExpenseForm`,
  and both member fixtures. Its `role` field picks up the uppercase `Role`.

**`src/modules/auth/types/auth.ts`**

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

export interface Landing {
  reason: LandingReason
  /** DELETION_PENDING only: the YYYY-MM-DD deadline from `until`. */
  until?: string
}
```

`SigninState`, `SigninResult`, `SigninErrorKind`, and `LoginInput` are deleted.

## 6. Session and Context

**`src/modules/auth/api/session.ts` → `me.ts`**

- `meKey = ['auth', 'me'] as const` (was `sessionKey`).
- `useMe()` — `GET /auth/me`, unwrapped, `retry: false`, `staleTime: 60_000`.
  Dropping from `Infinity` matters: `/auth/me` is the revocation signal, so
  caching it forever defeats its purpose.
- `useLogin` is deleted.
- **`useLogout` is new.** It does not exist in the tree — an earlier version did
  not survive `a1a9cc5`, and `grep` finds no logout caller anywhere outside the
  mocks. It posts `/auth/logout`, then `queryClient.clear()` and navigates to
  `/signin` via `useNavigate`, so every caller is just a button. Clearing rather
  than invalidating is what stops one person's ledger painting for the next
  person on a shared device.

**Sign-out control — `components/Layout/Sidebar.tsx`.** A sign-out button beside
the account tile (which is a `Link` to settings and stays one). This is the only
trigger; `Sidebar` is `hidden lg:flex` and `BottomBar` has no account area, so
**mobile has no way to sign out**. Accepted deliberately and deferred — see §14.

**`src/contexts/HouseholdContext.tsx`**

```ts
interface HouseholdContextValue {
  me: Me | null
  householdId: string
  role: Role
  isAuthenticated: boolean
  isLoading: boolean
  householdStatus: HouseholdStatus | null
  scheduledDeletionDate: string | null
}
```

Reads `me.household_id`, `me.household_name` directly. The render-time
`setHouseholdId` feed is unchanged — that race fix still holds.

**Ripple** (mechanical renames: `user?.name` → `me?.name`,
`household?.name` → `me?.household_name`): `utils/permissions.ts` (→ `Role.ADMIN`),
`Layout/Sidebar.tsx`, `Layout/DashboardLayout.tsx`, `pages/DashboardPage.tsx`,
`settings/pages/SettingsPage.tsx`, `financial/components/ExpenseForm.tsx`,
`financial/pages/ExpensesPage.tsx`, `hooks/useCurrency.ts`,
`routes/ProtectedRoute.tsx`, `contexts/HouseholdContext.test.tsx`,
`mocks/fixtures/household.ts`.

**`settings/types/settings.ts`: `Member.role` realigns to the shared `Role`**,
touching `MemberSection.tsx` and `mocks/fixtures/members.ts`. Included because
this change is what would otherwise leave two conflicting spellings of one enum
in the repo.

## 7. Routing and Landings

**`src/routes/index.tsx`**

```tsx
{ path: '/signin', element: <SigninPage />, errorElement: <ErrorPage /> },
```

`/auth/signin` and `/auth/login` are **removed**. `/signin` is the only public
route.

**Deleted with them:** `modules/auth/pages/LoginPage.tsx`,
`modules/auth/components/LoginForm.tsx`,
`modules/auth/components/LoginForm.test.tsx`,
`components/Layout/AuthLayout.tsx`, `useLogin`, `LoginInput`.

Rationale for deleting rather than parking: v1 has no password endpoint, and
`PRODUCT.md` puts passwords in Phase 2 as an open question, not a plan. Unlike
the mock handlers — which work again the moment they are re-registered — this
code can never work again without a backend that does not exist.

**Every URL a visitor can land on:**

| Landing                                               | Emitted by                         | Renders                        |
| ----------------------------------------------------- | ---------------------------------- | ------------------------------ |
| `/dashboard`                                          | signin / claim / invite redeemed   | the app                        |
| `/signin?error=invalid_link`                          | token unknown, expired, or spent   | notice: expired                |
| `/signin?error=household_unavailable`                 | claim/invite, household not ACTIVE | notice: unavailable            |
| `/signin?error=already_in_household`                  | invite, address active elsewhere   | notice: already in a household |
| `/signin?household=deletion_pending&until=YYYY-MM-DD` | signin redeemed during grace       | **deletion modal**             |
| `/signin?error=session_ended`                         | our own 401 interceptor            | notice: session ended          |

`landingFromParams(params): Landing | null` grows from two cases to five. The
scenes' prop type changes from `LandingReason` to `Landing | null` — **type only,
arity unchanged** — so all three scenes stay one-prop pass-throughs.

**`until` is validated against `YYYY-MM-DD` before use.** It is attacker-
controllable URL text rendered as a date. If missing or malformed, the page falls
back to the `household_unavailable` notice rather than opening the modal, because
PRD §2's modal is _deadline and nothing else_ — a modal with no deadline says
nothing.

## 8. Signin Wiring

**`src/modules/auth/api/signin.ts`** — `useRequestSigninLink()`, a plain
`useMutation` posting `/auth/signin`.

**`src/modules/auth/signin/signin.ts`** keeps the pure logic and loses the stub:
`landingFromParams`, `LINK_TTL_MINUTES`, `MAX_REQUESTS_PER_HOUR`, and a new pure
`signinErrorFromResponse(error)`:

| Status              | Result                                                             |
| ------------------- | ------------------------------------------------------------------ |
| 400                 | `FORMAT` — malformed or non-ASCII                                  |
| 401                 | `NOT_INVITED`                                                      |
| 403                 | not inline — opens the modal with `details.deletion_scheduled_for` |
| 429                 | `RATE_LIMITED` — per-address ration or global throttle             |
| other / no response | `NETWORK`                                                          |

**Card state.** In TanStack v5, calling `mutate` again flips `status` back to
`pending`, so `isSuccess` is **false during a resend**. Keying the sent view on
`isSuccess` would flash the form back mid-resend. The latch is `sendsUsed`, one
`useState<number>` incremented in `onSuccess`:

| Derived             | From                                      |
| ------------------- | ----------------------------------------- |
| view (sent vs form) | `sendsUsed > 0`                           |
| first-send spinner  | `isPending && sendsUsed === 0`            |
| resend spinner      | `isPending && sendsUsed > 0`              |
| email in sent copy  | `mutation.variables`                      |
| "Change email"      | `mutation.reset()` + `setSendsUsed(0)`    |
| inline error        | `signinErrorFromResponse(mutation.error)` |

**The resend counter is a hint; the 429 is the truth.** `MAX_REQUESTS_PER_HOUR`
counts in the browser, so a reload resets it while the server's hour does not —
the UI will sometimes offer a resend the API refuses. A 429 _in the sent view_
replaces the resend button with `signin_err_rate` rather than being swallowed
because the card has left the form. A 403 on resend opens the modal, as on first
send.

## 9. Household Deletion Modal

**`src/modules/auth/signin/HouseholdDeletionModal.tsx`**, PRD §2's signature:

```tsx
<HouseholdDeletionModal deadline={deletionDeadline} onDismiss={clearDeadline} />
```

- Built on Radix **`Dialog`** with `role="alertdialog"`. `AlertDialog` suppresses
  outside-click dismissal by design; PRD §2 requires the backdrop to dismiss.
  `Dialog` gives Escape and backdrop dismissal out of the box.
- **Focus needs explicit handling.** Radix restores focus to the trigger, but this
  modal has no trigger — it opens from a URL parameter or a mutation error. So
  `onCloseAutoFocus` moves focus to the email input via a ref `SigninCard` holds.
  Without it, dismissing drops focus to `<body>`.
- **Deadline and nothing else** — heading, the date through the existing
  `formatDate(iso, locale)`, the "ask your household admin" line, and "Back to
  sign in". No household name, no admin identity: this renders for an
  unauthenticated stranger who typed an address into a box, so anything
  identifying turns signin into a harvester.
- **One state, two entry points.** `SigninCard` holds
  `deletionDeadline: string | null`, seeded from `landing.until` when the reason
  is `DELETION_PENDING`, and set by the 403 branch.
- **Dismissal strips the query string** (`navigate('/signin', { replace: true })`)
  when the modal came from the URL. Otherwise the modal reopens on reload, which
  reads as a broken dismiss.
- `ConfirmDialog`'s "the only modal in the product" comment is corrected to state
  what distinguishes them: `ConfirmDialog` is for a choice, this is for a dead end.

## 10. i18n

New keys in **both** `messages/en.json` and `messages/id.json`:

| Key                                                                            | For                                                                                            |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `land_unavailable_title` / `_body`                                             | `?error=household_unavailable`                                                                 |
| `land_already_title` / `_body`                                                 | `?error=already_in_household`                                                                  |
| `deletion_title`, `deletion_body` (`{date}`), `deletion_note`, `deletion_back` | the modal                                                                                      |
| `act_signout`                                                                  | the Sidebar sign-out button (`act_*` is the existing action namespace, alongside `act_cancel`) |

Everything else reuses shipped keys: the four `signin_err_*`, both existing
`land_*` pairs, and the `sent_*` family.

## 11. Mocks

- Six handler files (`accounts`, `auth`, `categories`, `expenses`, `members`,
  `prefs`) gain the `*/api/v1/…` wildcard prefix. Prefix only, no logic changes.
- `handlers/auth.ts` is rewritten to the v1 shape — envelope responses and the
  documented 400/401/403/429 branches on signin — and **exported but not
  registered**. `handlers/index.ts` includes it only when `VITE_MOCK_AUTH` is set,
  documented in `.env.example`.
- Tests opt into them per-case with `server.use(...authHandlers)`. That is what
  keeps them exercised rather than rotting as dead weight.
- `fixtures/household.ts` gains `MOCK_ME` in the v1 wire shape; `MOCK_USER` stays
  for the roster.

## 12. Tests

| File                                     | Change                                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `api/client.test.ts`                     | exemption keyed on request URL; **new case: a 401 from `POST /auth/signin` must not redirect**                                             |
| `contexts/HouseholdContext.test.tsx`     | authenticates via `server.use(...authHandlers)`, not `POST /auth/login`                                                                    |
| `routes/ProtectedRoute.test.tsx`         | redirect target `/signin`                                                                                                                  |
| `utils/permissions.test.ts`              | `Role.ADMIN`                                                                                                                               |
| `signin/signin.test.ts`                  | **new** — `landingFromParams` across five reasons plus missing/malformed `until`; `signinErrorFromResponse` across the status table        |
| `signin/SigninCard.test.tsx`             | rewritten against MSW: success → sent view; 400/401/429 inline; 403 → modal; resend holds the sent view while pending; change-email resets |
| `signin/HouseholdDeletionModal.test.tsx` | **new** — `role="alertdialog"`, Escape and backdrop dismiss, focus returns to the email input                                              |
| `Layout/Sidebar.test.tsx`                | **new** — sign-out posts `/auth/logout`, clears the cache, lands on `/signin`                                                              |
| `components/LoginForm.test.tsx`          | deleted                                                                                                                                    |

## 13. Verification

`npm run type-check`, `npm run lint`, `npm run test`, `npm run build`.

Plus one manual pass against the real backend on `:3073`, since the
redirect-and-cookie loop is the one thing MSW cannot prove: request a link, click
it in the email, land on `/dashboard`, reload and stay signed in, log out and land
on `/signin`.

## 14. Known Debt Created

- **No sign-out on mobile.** The only trigger lives in `Sidebar`, which is
  `hidden lg:flex`; `BottomBar` has no account area. Raised during design and
  deliberately deferred — a member on a phone, the product's explicitly stated
  secondary persona, cannot end their session on a shared device. Closing it
  means either an account area on `BottomBar` or PRD §5's Account settings
  section, whichever the next auth spec takes.
- `/auth/login` and its password form are gone. If passwords return in Phase 2
  they are rebuilt, not restored.
- The resend counter is per-page-load and cannot see the server's hour window.
  Accepted: the 429 is authoritative and renders.
- Expenses, settings, members, and prefs remain on MSW at `*/api/v1/…` paths.
  Their real endpoints are unshipped; each migrates in its own spec, including
  the camelCase mapping deferred here.
