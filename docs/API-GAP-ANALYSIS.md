# FE ↔ BE gap analysis

**Source of truth:** `notes/Postman/nostos-api.postman_collection.json` — _NOSTOS — Household
API_ (NestJS 11 / Express 5), generated from the app's own controllers and OpenAPI document
(`buildOpenApiDocument`), so every path, parameter, body field and example in it is what the
code actually serves.

**FE reviewed at:** `refactor/code`, post-refactor (see
[`REFACTOR-2026-08-31.md`](REFACTOR-2026-08-31.md)).

> `notes/` is a machine-local symlink and is gitignored. Anyone without it should re-export
> the collection from Postman before relying on this document.

---

## 0. Executive summary

|                                                                          |                                                                                         |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Endpoints the API serves (member-facing, excl. `/console` and `/health`) | **12**                                                                                  |
| Distinct endpoints the FE calls                                          | **18**                                                                                  |
| FE calls that hit a real endpoint                                        | **3** (17%)                                                                             |
| …and those 3 still need path, casing and envelope changes                | **all 3**                                                                               |
| FE features with **no backend at all**                                   | Expenses, categories, accounts, users roster, household prefs — i.e. the entire product |
| Systemic convention mismatches affecting every single call               | **7** (§2)                                                                              |

Two findings dominate everything else:

1. **The whole financial module has no API.** Not "shapes differ" — there is no
   `/expenses`, `/expense-types`, `/payment-sources`, `/users` or `/prefs` endpoint of any
   kind. The shipped API covers operator household administration and member
   authentication/membership only. §4.
2. **The FE's auth model does not exist server-side.** The API is passwordless magic-link
   with a session cookie minted by a 302 redirect from an emailed link. The FE's reachable
   login screen posts email+password to `POST /auth/login`, which is not a route. §5.

Everything else is mechanical.

---

## 1. The complete API surface

22 endpoints. `/console/*` is a separate operator application and out of scope for this
frontend; it is listed for completeness because the two identities share the API.

### Member-facing — this app's scope

| Method | Path                                                     | Notes                                                   |
| ------ | -------------------------------------------------------- | ------------------------------------------------------- |
| POST   | `/api/v1/auth/signin`                                    | Emails a 15-minute magic link. 3/hour per address → 429 |
| GET    | `/api/v1/auth/signin/:token`                             | **302, no body.** Mints the session cookie              |
| GET    | `/api/v1/auth/claim/:token`                              | **302.** Admin claim link, 48 h                         |
| GET    | `/api/v1/auth/invite/:token`                             | **302.** Member invite, 48 h                            |
| GET    | `/api/v1/auth/me`                                        | The signed-in member, re-read from the DB every request |
| POST   | `/api/v1/auth/logout`                                    | Destroys this session only                              |
| POST   | `/api/v1/auth/leave-household`                           | Body `{ confirmation: "LEAVE" }`                        |
| POST   | `/api/v1/auth/change-email`                              | Body `{ new_email }`, 24 h confirmation link            |
| GET    | `/api/v1/auth/confirm-email-change/:token`               | **302.** Mints no session                               |
| POST   | `/api/v1/households/:id/members`                         | Invite. Requires `X-Household-ID`                       |
| POST   | `/api/v1/households/:id/members/:memberId/resend-invite` | 3 per invite → 429                                      |
| DELETE | `/api/v1/households/:id/members/:memberId`               | Tombstones                                              |

### Out of scope

`GET /health`; `POST|GET /api/v1/console/auth/*` (4); `/api/v1/console/households*` (6).

### Methods actually used by the API

```
GET: 10   POST: 12   DELETE: 1   PUT: 0   PATCH: 0
```

**There is not one `PUT` in the API.** Updates are modelled as POST action routes
(`/console/households/:id/delete`, `/restore`, `/resend-invite`). The FE uses `PUT` for
every update it performs — `/expense-types/:id`, `/payment-sources/:id`,
`/households/:id/prefs`, `/expenses/:id`. That convention is the FE's own invention and must
be confirmed before the expenses API is designed, not after. §6.4.

---

## 2. Systemic convention mismatches

These affect **every** request, including the three that already exist. Each is a
single-place fix in the FE, and each is currently wrong.

### 2.1 Base path

|     |                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------- |
| FE  | `baseURL: import.meta.env.VITE_API_URL \|\| '/api'` — `src/api/client.ts:15`; `.env.example` ships `VITE_API_URL=/api` |
| API | `/api/v1/...`                                                                                                          |

Every FE call is missing `/v1`. The `signin.ts:8` doc comment already flags this — _"note
the `v1`, which the app's current axios baseURL (`/api`) does not carry"_ — so it was known
and never fixed.

**Fix:** `VITE_API_URL=/api/v1`, and update `.env.example`. One line.

### 2.2 Casing: camelCase vs snake_case

> _"Request bodies, query parameters and response keys are snake_case throughout —
> `household_id`, `created_at`, `sort_by`, `status_code`. There is no camelCase translation
> layer anywhere in the API; a client wanting camelCase maps it on its own side."_

The FE is camelCase end to end. Affected on the wire today:

| FE                                                                         | API convention                                                                    |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `sortBy`, `sortOrder`                                                      | `sort_by`, `sort_order`                                                           |
| `typeId`, `sourceId`, `paidByUserId`, `datePaid`                           | `type_id`, `source_id`, `paid_by_user_id`, `date_paid`                            |
| `householdId`, `archivedAt`, `openingBalance`, `asOf`                      | `household_id`, `archived_at`, `opening_balance`, `as_of`                         |
| `monthStartDay`, `invitePending`, `resendCount`                            | `month_start_day`, `invite_pending`, `resend_count`                               |
| `deletedAt`, `deletionReason`, `createdByUserId`, `createdAt`, `updatedAt` | `deleted_at`, `deletion_reason`, `created_by_user_id`, `created_at`, `updated_at` |
| `new_email`, `confirmation` (bodies)                                       | already snake_case ✅                                                             |

Also: **sort direction case.** FE sends `desc`/`asc`; the API's documented values are
`DESC`/`ASC`.

**Fix — two boundaries, not scattered:**

- **Outbound:** `toRequestParams()` in `src/modules/financial/api/expenses.ts:36-56` already
  exists precisely as the single place the wire shape is written out. Mutation bodies need
  the same treatment (a `toRequestBody()` per entity file).
- **Inbound:** a response mapper per entity, or one generic `snakeToCamel` in
  `src/api/client.ts` as a response interceptor.

A blanket interceptor is tempting and is the wrong default — it would also rewrite
`error.status_code` and the validation `details[].field` names, which the FE will want to
match against API field names verbatim. Prefer explicit per-entity mappers, or a blanket
mapper with the error envelope excluded.

### 2.3 The success envelope — the highest-impact mismatch

> _"Every route except `/health` and the four 302 routes is wrapped. Success is
> `{ success: true, message?, data, meta? }`. **`data` is always the resource itself**,
> never a wrapper around it."_

The FE reads axios's `.data` **as the resource**:

```ts
// src/modules/settings/api/categories.ts:25
;(await apiClient.get<Category[]>('/expense-types')).data
// ^ axios .data is the ENVELOPE. This is { success, data: Category[] }, not Category[].
```

Every read in the app is off by one level. `categories.data.map(...)` would throw or
silently render nothing.

**Fix:** one response interceptor in `src/api/client.ts` that unwraps `data.data` on
success, so no call site changes:

```ts
apiClient.interceptors.response.use((response) => {
  // Envelope: { success, message?, data, meta? } — hand callers the resource, and
  // keep `meta` reachable for paginated reads.
  if (
    response.data &&
    typeof response.data === 'object' &&
    'success' in response.data
  ) {
    response.meta = response.data.meta
    response.data = response.data.data
  }
  return response
})
```

The four 302 routes and `/health` are unwrapped, but the FE never calls them from axios
(§5.2), so no exception is needed.

### 2.4 Pagination

| FE (`src/types/api.ts:16-26`)                                              | API                                                                          |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `{ items, pagination: { total, page, pages }, totals? }` — all in the body | `data` is the array; `meta.pagination = { page, limit, total, total_pages }` |
| `pagination.pages`                                                         | `meta.pagination.total_pages`                                                |
| —                                                                          | `meta.pagination.limit` (FE does not read it back)                           |
| `totals: { sum, count, average }`                                          | **no equivalent anywhere in the documented envelope**                        |

`totals` is not a naming mismatch — it is a **feature the API does not have**. See §6.2; it
cannot be computed client-side, because it describes the whole filtered set rather than the
page the FE holds.

### 2.5 Error envelope

The one place the FE is already right.

|                                              |                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| API                                          | `{ success: false, error: { code, message, status_code, timestamp, path, details? } }` |
| FE `ApiErrorBody` (`src/types/api.ts:5-14`)  | reads `error.code`, `error.message` ✅                                                 |
| FE `getErrorMessage` (`src/utils/errors.ts`) | `body?.error?.message ?? body?.message ?? error.message` ✅                            |

Two gaps remain:

1. **> "Branch on `error.code`, not `status_code` — several codes share one HTTP status."**
   The FE branches on nothing. `getErrorCode` existed for this and was deleted as dead code
   (findings §4) — it will need to come back, with actual call sites. Codes the UI must
   distinguish: `HOUSEHOLD_DELETION_PENDING`, `HOUSEHOLD_MISMATCH`, `VALIDATION_ERROR`,
   `WHITELIST_VALIDATION`, `CONFLICT`, and the throttle codes.
2. **Validation `details[]` are unused.** A 400 carries one entry per failed constraint
   (`{ field, code, message }`), with `code` being the class-validator constraint
   upper-snaked. The FE renders a single flat message, so per-field server errors are lost.
   `react-hook-form`'s `setError(field, …)` is the natural target.

Note `HOUSEHOLD_DELETION_PENDING.details.deletion_scheduled_for` is published in **every**
environment specifically because a lockout screen renders from it. The FE has no such
screen. §6.5.

### 2.6 Role values

| FE (`src/types/household.ts:1`)   | API                     |
| --------------------------------- | ----------------------- |
| `type Role = 'admin' \| 'member'` | `"ADMIN"` \| `"MEMBER"` |

`canManageExpenses(role)` compares `role === 'admin'` and would be **false for every
admin**, silently reducing every admin to member permissions. `MemberSection` also filters
on `member.role !== 'admin'` to decide who can be removed — which would offer a remove
button for the household admin, an action the API rejects with 409.

### 2.7 Auth transport

|     |                                                                          |
| --- | ------------------------------------------------------------------------ |
| API | Postgres-backed session cookie `household.sid`. **Never a bearer token** |
| FE  | `withCredentials: true` (`src/api/client.ts:16`), no token in storage ✅ |

Correct already. The cookie needs same-origin or properly configured CORS — §7.

---

## 3. Endpoint-by-endpoint mapping

| #   | FE call                                                | FE location        | API status                                                      |
| --- | ------------------------------------------------------ | ------------------ | --------------------------------------------------------------- |
| 1   | `POST /auth/login`                                     | `session.ts:24`    | ❌ **No such route.** Password auth does not exist              |
| 2   | `GET /auth/session`                                    | `session.ts:13`    | ⚠️ Wrong path → `GET /auth/me`; different response shape (§6.1) |
| 3   | `GET /expenses`                                        | `expenses.ts:123`  | ❌ Not built                                                    |
| 4   | `POST /expenses`                                       | `expenses.ts:135`  | ❌ Not built                                                    |
| 5   | `DELETE /expenses/:id`                                 | `expenses.ts:178`  | ❌ Not built                                                    |
| 6   | `GET /expense-types`                                   | `categories.ts:25` | ❌ Not built                                                    |
| 7   | `POST /expense-types`                                  | `categories.ts:46` | ❌ Not built                                                    |
| 8   | `PUT /expense-types/:id`                               | `categories.ts:53` | ❌ Not built (and no PUT anywhere, §6.4)                        |
| 9   | `GET /payment-sources`                                 | `accounts.ts:14`   | ❌ Not built                                                    |
| 10  | `POST /payment-sources`                                | `accounts.ts:35`   | ❌ Not built                                                    |
| 11  | `PUT /payment-sources/:id`                             | `accounts.ts:43`   | ❌ Not built                                                    |
| 12  | `GET /users`                                           | `members.ts:42`    | ❌ Not built                                                    |
| 13  | `GET /households/:id/members`                          | `members.ts:34`    | ❌ **Path exists, method does not.** Only POST/DELETE (§6.3)    |
| 14  | `POST /households/:id/members`                         | `members.ts:49`    | ✅ Exists — shape differs (§6.3)                                |
| 15  | `POST /households/:id/members/:memberId/resend-invite` | `members.ts:56`    | ✅ Exists — error code differs (§6.3)                           |
| 16  | `DELETE /households/:id/members/:memberId`             | `members.ts:63`    | ✅ Exists                                                       |
| 17  | `GET /households/:id/prefs`                            | `prefs.ts:20`      | ❌ Not built                                                    |
| 18  | `PUT /households/:id/prefs`                            | `prefs.ts:30`      | ❌ Not built                                                    |

Mock-only, no client caller: `PUT /expenses/:id`, `GET /expenses/:id`, `POST /auth/logout`.

### API endpoints the FE does not call

| Endpoint                                | FE state                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `POST /auth/signin`                     | `submitSignin` is a `setTimeout` stub — `signin.ts:37-42`                |
| `GET /auth/signin/:token`               | Not callable from the app: the **browser** hits it from the email (§5.2) |
| `GET /auth/claim/:token`                | No claim flow                                                            |
| `GET /auth/invite/:token`               | No invite-acceptance flow                                                |
| `GET /auth/me`                          | Calls `/auth/session` instead                                            |
| `POST /auth/logout`                     | Hook deleted as dead code; no sign-out UI exists                         |
| `POST /auth/leave-household`            | Copy exists (`mem_leave`, `mem_leave_admin`), no implementation          |
| `POST /auth/change-email`               | No email-change UI                                                       |
| `GET /auth/confirm-email-change/:token` | Landing route `/settings/account` does not exist                         |

---

## 4. Missing: the entire financial module

**No endpoint in the collection serves expenses, categories, accounts, the user roster or
household preferences.** `grep -oiE '(expense|payment|source|prefs|/users|categor)'` over
the collection returns 3 incidental matches in prose and nothing structural.

This is the product's core. The FE has a complete, tested, mock-backed implementation of it
and nothing to point at.

### 4.1 What the BE must build

Named with the API's own conventions (snake_case, POST-for-action, `/api/v1`, envelope).

#### Expenses

```
GET    /api/v1/expenses
         query: page, limit, sort_by, sort_order, date_from, date_to,
                type_id, source_id, paid_by_user_id, search
         data:  Expense[]
         meta:  { pagination: {page,limit,total,total_pages},
                  totals: {sum,count,average} }   ← see §6.2
POST   /api/v1/expenses
GET    /api/v1/expenses/:id
POST   /api/v1/expenses/:id            (or PUT — decide, §6.4)
DELETE /api/v1/expenses/:id
```

`Expense`: `id, name, value, type_id, source_id, date_paid, paid_by_user_id, household_id,
created_by_user_id?, created_at?, updated_at?`.

Permission matrix the FE already implements: **create** = member ✅ admin ✅;
**update/delete** = admin only.

#### Categories (the FE calls these `expense-types`)

```
GET    /api/v1/expense-types           data: Category[]   ← must include archived rows
POST   /api/v1/expense-types           body: { name }
POST   /api/v1/expense-types/:id       body: { name?, archived_at? }
```

`Category`: `id, name, order, archived_at, household_id`.

Two hard requirements the FE depends on:

- **`order` must be stable and server-assigned.** The FE derives every category's rim colour
  from it (`rimFor(order)` — `src/theme/rims.ts`). Deriving colour from array position was a
  bug (findings §3.4); if `order` shifts on archive, the colours shift with it.
- **Archived rows must be returned**, not filtered. `archived_at` exists so a category
  survives its own retirement — past expenses keep pointing at it — and the Restore action
  only renders when `archived_at` is set. Hiding archived rows makes archiving one-way
  (findings §5.3).

#### Accounts (the FE calls these `payment-sources`)

```
GET    /api/v1/payment-sources         data: Account[]    ← must include archived rows
POST   /api/v1/payment-sources
POST   /api/v1/payment-sources/:id
```

`Account`: `id, name, kind ('cash'|'bank'|'ewallet'), opening_balance, as_of, order,
archived_at, household_id`. Same `order` and archived requirements.

#### User roster

```
GET    /api/v1/users                   data: User[]
```

`User`: `id, name, email, role, household_id`. Feeds the "paid by" picker and the ledger's
name resolution — so it must include **tombstoned** members, or names on historical rows
resolve to `—`. The mock currently returns active members only, which is a latent bug the
real API should not copy: attribution has to survive removal.

#### Household preferences

```
GET    /api/v1/households/:id/prefs    data: { currency, month_start_day }
POST   /api/v1/households/:id/prefs
```

Admin-only writes. `currency` is now consumed app-wide via `useCurrency()`;
`month_start_day` is persisted but unread by the FE (findings §6.10) — worth confirming
whether it is a real requirement before building it.

### 4.2 Tenancy

All of the above are household-scoped, so they belong behind `TenantGuard` and must read
`X-Household-ID` — which the FE already sends on every request
(`src/api/client.ts:19-24`). Note the guard's contract: the header must equal the household
on the session row, and a mismatch is `400 HOUSEHOLD_MISMATCH`. The FE has no handler for
that code (§2.5).

---

## 5. Auth: the deepest gap

### 5.1 The models do not correspond

|                     | API                                                | FE                                         |
| ------------------- | -------------------------------------------------- | ------------------------------------------ |
| Mechanism           | Passwordless magic link                            | Email + password                           |
| Credential endpoint | `POST /auth/signin` (emails a link)                | `POST /auth/login` (posts a password)      |
| Session minted by   | `GET /auth/signin/:token` → **302** + `Set-Cookie` | the login response body                    |
| Reachable FE screen | —                                                  | `/auth/login`, `LoginForm`                 |
| Designed FE screen  | —                                                  | `/auth/signin`, `SigninCard` — **stubbed** |

`POST /auth/login` does not exist. The FE's reachable login screen has no server.

Meanwhile `/auth/signin`'s `submitSignin` (`src/modules/auth/signin/signin.ts:37-42`) is a
600 ms `setTimeout` that branches on whether the address contains `"belum"` or `"limit"`.
It bypasses `apiClient`, react-query, the 401 interceptor and `getErrorMessage` entirely,
and it is wired to a live route.

Two constants in that file **already match the API**: `LINK_TTL_MINUTES = 15` ("valid for 15
minutes") and `MAX_REQUESTS_PER_HOUR = 3` ("3 requests per hour, counted from the invite
table"). The rationing is server-authoritative and answers **429**; the FE currently counts
in component state, which resets on reload.

### 5.2 The 302 routes are not the app's to call

> _"All four always answer 302 with no body — a browser reaching them from an email client
> issues a plain GET, so the outcome is carried in the `Location` query string."_

`/auth/signin/:token`, `/auth/claim/:token`, `/auth/invite/:token` and
`/auth/confirm-email-change/:token` are hit by the **user's browser from their email**, not
by the SPA. The FE's job is to _receive_ the redirect, not issue the request. That means
routes and query-param handling, not axios calls.

### 5.3 Landing routes the API redirects to

`APP_URL` defaults to `http://localhost:5174`.

| API `Location`                                               | FE route exists?                                    |
| ------------------------------------------------------------ | --------------------------------------------------- |
| `APP_URL/dashboard`                                          | ✅ `/dashboard`                                     |
| `APP_URL/signin?error=invalid_link`                          | ❌ FE route is `/auth/signin`                       |
| `APP_URL/signin?household=deletion_pending&until=YYYY-MM-DD` | ❌ route, and FE does not parse `household`/`until` |
| `APP_URL/signin?error=household_unavailable`                 | ❌                                                  |
| `APP_URL/signin?error=already_in_household`                  | ❌                                                  |
| `APP_URL/settings/account?email_changed=1`                   | ❌ FE has `/settings`, no `/settings/account`       |
| `APP_URL/settings/account?error=invalid_link`                | ❌                                                  |
| `APP_URL/settings/account?error=address_taken`               | ❌                                                  |

`landingFromParams` (`src/modules/auth/signin/signin.ts:18-23`) handles **one** of these
(`invalid_link`) and invents one the API never sends (`session_ended`).

The API deliberately distinguishes `already_in_household` from `invalid_link` — _"telling
this person their link is broken invites a resend that can never work"_ — and
`address_taken` from `invalid_link` for the same reason. Collapsing them loses the whole
point of the distinction.

**Either** the FE adds `/signin` and `/settings/account` routes, **or** `APP_URL`-relative
paths are configured on the server to match the FE's `/auth/signin` and `/settings`. The
first is less coupling; decide explicitly.

### 5.4 Flows the FE has no implementation for

| Flow                   | Endpoint                                                       | FE state                                         |
| ---------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| Accept an invite       | `GET /auth/invite/:token` (302)                                | No landing handler. Invites cannot be accepted   |
| Claim an admin account | `GET /auth/claim/:token` (302)                                 | Same. **A new household's admin cannot get in**  |
| Leave a household      | `POST /auth/leave-household`, body `{ confirmation: "LEAVE" }` | Copy exists, no action. Note 409 when sole admin |
| Change email           | `POST /auth/change-email` + 302 confirm                        | Nothing                                          |
| Sign out               | `POST /auth/logout`                                            | Hook deleted; no UI ever existed                 |

The claim flow is the most serious: the operator console's "Create a household" emails a
claim link, and spending it _is_ the admin's first sign-in. Without a landing handler, a
freshly created household is unreachable.

---

## 6. Shape mismatches on what exists

### 6.1 `GET /auth/me` vs the FE's `Session`

```jsonc
// API — flat, snake_case
{
  "user_id": "…",
  "household_id": "…",
  "email": "…",
  "name": "…",
  "role": "ADMIN",
  "household_status": "ACTIVE",
  "scheduled_deletion_date": null,
}
```

```ts
// FE — nested, camelCase (src/types/household.ts:16-19)
interface Session {
  user: User
  household: Household
}
interface User {
  id
  name
  email
  role: 'admin' | 'member'
  householdId
}
interface Household {
  id
  name
}
```

Mismatches: nested vs flat · `user_id`→`id` · role case (§2.6) · **no `household.name`** ·
`household_status` and `scheduled_deletion_date` unmodelled.

**`household.name` is not obtainable.** No member-facing endpoint returns it — only
`GET /console/households/:id`, which is operator-only. The FE renders it in
`Sidebar.tsx:140` and interpolates it into `MemberSection`'s remove-confirmation copy
(`mem_remove_confirm` → _"Remove {name} from {household}?"_).

**→ BE ask: add `household_name` to `GET /auth/me`.** It is one join and it unblocks two
shipped surfaces.

### 6.2 `totals` has no server equivalent

`CountStrip` renders four figures from `totals` (`sum`, `count`, `average`, plus a
previous-month comparison) and `MonthRail` renders `monthTotal` from `totals.sum`. The
FE types them as part of `Paginated<T>` (`src/types/api.ts:33-37`) citing "BE PRD §3.1" —
but the shipped envelope documents only `meta.pagination`.

**This cannot be computed client-side.** `totals` describes the whole filtered set; the FE
holds one page. The workaround already in the code — `CountStrip.tsx:40-46` fetching the
previous month with `limit: 1` purely to read its `totals` — only works _because_ totals are
filter-scoped rather than page-scoped, and it collapses to `0` the moment the real API omits
them.

**→ BE ask: `meta.totals = { sum, count, average }` on `GET /expenses`, computed over the
filtered set, not the page.** This is a hard requirement, not a nice-to-have: without it,
the count strip and the month rail have nothing to render.

### 6.3 Members

**No list endpoint.** `GET /households/:id/members` — which `useMembers`
(`src/modules/settings/api/members.ts:34`) depends on, and which the entire `MemberSection`
renders from — does not exist. The path serves POST only. The only member list in the API is
inside `GET /console/households/:id`, operator-only.

**→ BE ask: `GET /api/v1/households/:id/members` for household admins,** returning the
member list with derived status.

Shape, from the invite response:

```jsonc
// API
{
  "id": "…",
  "name": "Sofia",
  "email": "sofia@email.com",
  "status": "pending",
  "invite_expires_at": "2026-02-02T09:15:00.000Z",
  "invite_sent_at": "2026-01-31T09:15:00.000Z",
}
```

```ts
// FE (src/modules/settings/types/settings.ts:13-24)
interface Member {
  id
  name
  email
  role
  householdId
  deletedAt
  deletionReason
  invitePending
  resendCount
}
```

| Issue                                | Detail                                                                                                                                                                                                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status: derived where?**           | The API _ships_ `status` ("derived from the latest invite, never stored"). The FE re-derives it in `memberStatus()` from `deletedAt`/`deletionReason`/`invitePending` — fields the API does not return. Given the payload above, `memberStatus()` returns `'joined'` for everyone |
| **Vocabulary differs**               | FE: `joined \| pending \| no_access \| left \| removed \| former`. API mentions `pending`, `invite_expired`, and accepted-implied. Needs reconciling — the FE's set is richer and encodes tombstone reasons the API may not expose                                                |
| **`role` absent**                    | FE gates the remove button on `member.role !== 'admin'`                                                                                                                                                                                                                           |
| **`resend_count` absent**            | FE renders _"Resend · N left"_ from `MAX_RESENDS - member.resendCount`. Without it the counter cannot be shown. The API instead answers **429** when exhausted                                                                                                                    |
| **Resend-exhausted status code**     | API: **429**. FE mock: **409**, and `MemberSection.test.tsx` asserts the 409 copy path. The FE's retry predicate correctly excludes 4xx, so no retry storm — but the copy is wired to the wrong branch                                                                            |
| `invite_expires_at`/`invite_sent_at` | Unmodelled by the FE. `invite_sent_at: null` means delivery failed and a resend is the recovery — the FE cannot currently show that state                                                                                                                                         |

Correct by luck: the FE hides remove for self and for admins, and the API 409s on exactly
those two cases.

### 6.4 No `PUT` in the API

The FE `PUT`s to `/expense-types/:id`, `/payment-sources/:id`, `/households/:id/prefs` and
(in the mock) `/expenses/:id`. The API uses zero PUTs, preferring POST action routes.

This is a convention decision to make **before** the expenses API is designed. Either the
new endpoints accept `PUT` for partial updates, or the FE moves to POST. Note that archive
and restore are already action-shaped in the FE's own terms — `update({ id, archived_at })`
and `update({ id, archived_at: null })` — and would read more naturally as
`POST /expense-types/:id/archive` and `/restore`, matching
`/console/households/:id/delete` and `/restore` exactly.

### 6.5 Household lifecycle is unhandled

`GET /auth/me` carries `household_status` (`ACTIVE` | `DELETION_PENDING`) and
`scheduled_deletion_date` — _"the two household lifecycle fields the in-app deletion banner
renders from."_ The FE has no banner, and `Session` models neither field.

`POST /auth/signin` also answers `403` with
`details.deletion_scheduled_for` when the household is in its grace period, and
`GET /auth/signin/:token` can redirect to
`?household=deletion_pending&until=YYYY-MM-DD`. Three separate surfaces expect a lockout
screen that does not exist.

`MemberSection` has a `householdActive` prop (defaulting to `true`) that nothing ever
passes — the seam is there, unwired.

### 6.6 `X-Household-ID` is sent too broadly

The FE sets it on every request (`src/api/client.ts:19-24`). The API reads it only on
`/households/*`; `/console/*` is `@Public()` and `/auth/*` is `@NoTenant()`. Harmless, and
the empty-string guard is correct — but the mismatch response `400 HOUSEHOLD_MISMATCH` has
no FE handler, and per the guard order (`Throttler → Auth → Tenant → Role`) it surfaces
_after_ authentication, so it will present as a confusing 400 on an otherwise valid session.

---

## 7. Dev and deployment wiring

### 7.1 No dev proxy, and the ports disagree

`vite.config.ts` has no `server` block, so Vite serves on **5173**. The API's `APP_URL`
defaults to **5174** — so every 302 from an emailed link lands on a port with nothing on it.

There is also no proxy, so `/api/v1/*` from the browser hits the Vite dev server, not
`http://localhost:3073`.

**Fix — a proxy keeps the session cookie same-origin, which is the whole reason to prefer
it:**

```ts
server: {
  port: 5174,                       // match the API's APP_URL default
  proxy: { '/api': { target: 'http://localhost:3073', changeOrigin: true } },
}
```

With that, `VITE_API_URL=/api/v1` works unchanged and `household.sid` needs no
`SameSite=None`.

### 7.2 Cross-origin cookies, if no proxy

Without a proxy the cookie is cross-site: the server needs CORS with
`Access-Control-Allow-Credentials`, an explicit origin allowlist, and
`SameSite=None; Secure` — which also means HTTPS in local dev. Strictly worse; use the
proxy.

### 7.3 Capacitor cannot use a relative base URL

`capacitor.config.ts` ships `webDir: 'dist'`, so the app is served from
`capacitor://localhost`. A relative `/api/v1` resolves to the device, not the backend, so
the native build needs an absolute `VITE_API_URL`. Cookie auth across that origin boundary
is a known dead end on iOS WKWebView — the native shell will need either a first-party
domain via `server.hostname` or a token-based path the API does not currently offer.

Worth deciding before native ships, since it may be the one case that forces a
non-cookie credential.

### 7.4 MSW only boots in dev

`src/main.tsx:13-14` gates the worker on DEV, so a production build today has no backend at
all. Correct behaviour — noted so the first real-API build's failures are read as
integration work rather than a regression.

---

## 8. Recommended integration order

Each step is independently shippable and verifiable against the Postman collection.

| #   | Step                                                                                                                                                                                                    | Unblocks                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | `VITE_API_URL=/api/v1` + Vite proxy on port 5174 (§2.1, §7.1)                                                                                                                                           | Any real request at all                 |
| 2   | Envelope-unwrapping response interceptor (§2.3)                                                                                                                                                         | Every read                              |
| 3   | snake_case mapping at the two boundaries; `Role` → `ADMIN`/`MEMBER`; `sort_order` uppercase (§2.2, §2.6)                                                                                                | Every request and response              |
| 4   | `getErrorMessage` + `getErrorCode` branching, and `details[]` → `setError` (§2.5)                                                                                                                       | All error copy                          |
| 5   | `/auth/session` → `/auth/me`, reshape `Session`, add `household_name` (BE) (§6.1)                                                                                                                       | The app shell — sidebar, permissions    |
| 6   | Wire `submitSignin` to `POST /auth/signin`; add `/signin` + `/settings/account` landing routes handling all documented `error`/`household` params; retire `/auth/login`, `LoginForm`, `AuthLayout` (§5) | Sign-in, invite acceptance, admin claim |
| 7   | Household lifecycle: model the two fields, build the lockout banner, pass `householdActive` (§6.5)                                                                                                      | Deletion-grace correctness              |
| 8   | **BE:** `GET /households/:id/members` for admins, with `role` and `resend_count` (§6.3)                                                                                                                 | The whole members section               |
| 9   | Reconcile member `status` — server-derived vs client-derived, one of the two (§6.3)                                                                                                                     | Member states                           |
| 10  | Sign-out: `POST /auth/logout` + a UI control + `queryClient.clear()`                                                                                                                                    | Shared-device safety                    |
| 11  | **BE:** the financial API — expenses, expense-types, payment-sources, users, prefs, with `meta.totals` and stable `order` (§4, §6.2)                                                                    | The product                             |
| 12  | Decide PUT vs POST-action for updates, then align (§6.4)                                                                                                                                                | Category/account/prefs writes           |
| 13  | Capacitor base URL and credential strategy (§7.3)                                                                                                                                                       | Native builds                           |

Steps 1–4 are FE-only, roughly a day, and turn every subsequent failure into a legible one.
Steps 8 and 11 are backend work and are the critical path — until 11 lands, the financial
module can only run against MSW.

---

## 9. Assumptions and caveats

- Derived entirely from the Postman collection dated **2026-08-30**. It claims to be
  generated from the controllers, but it is a snapshot — re-export before relying on any
  specific shape.
- Field-level shapes for `/expenses` and friends in §4.1 are **the FE's current model
  translated to the API's conventions**, not an agreed contract. They are a starting point
  for the BE conversation, not a specification.
- Response examples in the collection are illustrative; nullability and optionality should
  be confirmed against the OpenAPI document.
- `/console/*` is treated as a different application throughout. If this frontend is ever
  meant to serve operators too, that is a separate analysis.
- The FE side reflects `refactor/code` post-refactor. Line references will drift.
