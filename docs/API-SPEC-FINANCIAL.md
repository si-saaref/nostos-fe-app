# API spec — financial module

**Status:** proposal, for BE review. **Date:** 2026-09-05.

This is the contract the frontend now implements against, written out so the backend has
something concrete to build to. It covers the endpoints the ledger cannot render without:

| Group     | Endpoints                                                   |
| --------- | ----------------------------------------------------------- |
| Expenses  | `/expenses` — list, create, read, update, delete            |
| Reference | `/expense-types`, `/payment-sources` — list, create, update |
| People    | `GET /households/:id/members` and its two invite routes     |

**Where it comes from.** Every shape below is what the FE's mock backend
(`src/mocks/handlers/*`) answers today, after being adjusted in this pass to the API's own
conventions — snake_case, the `{ success, data, meta }` envelope, `meta.pagination`,
uppercase sort directions. So the FE is already written against it: if the real API answers
these shapes, the financial module works with no further frontend change. That is the point
of the document.

**What it is not.** Not an agreed contract, and not a description of anything shipped. The
field-level model is the FE's, translated into the API's conventions. Anywhere the backend
has a reason to differ, the FE side is a one-file change at the boundary — the mappers named
in §1.5. Where a shape is load-bearing rather than incidental, this document says so
explicitly, because those are the ones worth pushing back on before they are built.

**§7 reconciles this document against `MASTER_PRD_EXPENDITURE` (v3.0).** Read it before
building: it lists the four places the PRD was right and this spec has been corrected, the
three genuine conflicts still needing a decision, and the PRD statements that are simply out
of date and should not be implemented.

Companion reading: [`API-GAP-ANALYSIS.md`](API-GAP-ANALYSIS.md) — why none of this exists
yet, and the eleven other things that also need doing.

---

## 1. Conventions

These are the shipped API's own, not new inventions. They are restated because every shape
below assumes them.

### 1.1 Base path, tenancy, auth

```
/api/v1/...
```

Every endpoint here is household-scoped: behind the tenant guard, reading `X-Household-ID`,
which must equal the household on the session row. A mismatch is `400 HOUSEHOLD_MISMATCH`.
Credentials are the `household.sid` session cookie — never a bearer token. The FE sends the
header on every request and `withCredentials: true`.

### 1.2 Casing

snake_case on the wire, in request bodies, query parameters and response keys alike. The FE
is camelCase internally and maps at the boundary; that is the FE's problem, not the API's.

Sort directions are `ASC` / `DESC` — uppercase. Sort columns are wire column names
(`date_paid`, not `datePaid`).

### 1.3 The envelope

Success:

```jsonc
{ "success": true, "message": "…", "data": …, "meta": { … } }
```

`data` is **always the resource itself**, never a wrapper around it. A list route puts the
array in `data` and its counts in `meta`. `message` is optional and human-facing.

Error:

```jsonc
{
  "success": false,
  "status_code": 409,
  "error": {
    "code": "CONFLICT",
    "message": "Already in a household. Ask them to leave it first, then invite again.",
    "details": null,
  },
}
```

`error.message` is rendered verbatim in several places — the invite conflicts especially,
where the differing wording per case is the entire feature. Do not genericise it. Clients
branch on `error.code`, never on `status_code`: several codes share one status.

A `400 VALIDATION_ERROR` carries one `details[]` entry per failed constraint:

```jsonc
"details": [{ "field": "date_paid", "code": "IS_DATE_STRING", "message": "…" }]
```

### 1.4 Verbs

| Verb     | Used for                                                        |
| -------- | --------------------------------------------------------------- |
| `GET`    | Reads.                                                          |
| `POST`   | Creates, and the one action route (`/resend-invite`).           |
| `PATCH`  | **Every update.** Partial bodies. §3.8                          |
| `DELETE` | Removals — a hard delete for expenses, a tombstone for members. |

No `PUT` anywhere. See §3.8 for why `PATCH` rather than the API's existing `POST`-for-action
style, and for the absent / value / `null` semantics the partial body depends on.

### 1.5 Where the FE maps this

One function per direction per entity, so a shape change is a single diff:

| Entity   | Wire type      | Inbound      | Outbound                           |
| -------- | -------------- | ------------ | ---------------------------------- |
| Expense  | `WireExpense`  | `toExpense`  | `toRequestParams`, `toExpenseBody` |
| Category | `WireCategory` | `toCategory` | `toCategoryBody`                   |
| Account  | `WireAccount`  | `toAccount`  | `toAccountBody`                    |
| Member   | `WireMember`   | `toMember`   | `toInviteBody`                     |

Envelope and page unwrapping are shared: `unwrap` and `unwrapPage` in `src/api/client.ts`.

---

## 2. Pagination

Only `GET /expenses` is paginated. The reference and people lists are small, bounded by the
household, and return in full — the FE depends on that (see §4.1, §5.1).

```jsonc
// GET /api/v1/expenses?page=1&limit=25
{
  "success": true,
  "data": [/* Expense[] — this page only */],
  "meta": {
    "pagination": { "page": 1, "limit": 25, "total": 84, "total_pages": 4 },
    "totals": { "sum": 7419500, "count": 84, "average": 88327 },
  },
}
```

| Field                    | Type | Notes                                        |
| ------------------------ | ---- | -------------------------------------------- |
| `pagination.page`        | int  | 1-based. Echoes the request.                 |
| `pagination.limit`       | int  | Echoes the request. Default 25, max 500.     |
| `pagination.total`       | int  | Rows matching the **filters**, not the page. |
| `pagination.total_pages` | int  | `ceil(total / limit)`, minimum 1.            |

`meta.pagination` is **mandatory on every list response**, including an empty one. The FE
throws a named error rather than defaulting it: a defaulted page silently claims one page of
one row, which is indistinguishable from a genuinely small result set, and the count strip
would then under-report with confidence.

An out-of-range `page` returns `data: []` with the real `total` and `total_pages` — not a 404. The FE recovers by re-requesting page 1, which it can only do if it is told where the
end is.

### 2.1 `meta.totals` — a hard requirement

`totals` describes **the whole filtered set**, computed before the page is sliced out of it.
It is not page-scoped and cannot be derived client-side: the FE holds 25 rows and needs the
sum of all 84.

Three surfaces render from nothing else:

- **The count strip** — total spend, entry count, average per entry, and a month-on-month
  delta. It fetches the previous month with `limit: 1` purely to read that month's `totals`,
  which works only because they are filter-scoped.
- **The month rail** — the month total each day's cumulative figure is measured against.
- **Your share** — the signed-in member's percentage of the filtered total.

Without `meta.totals` these have nothing to show and collapse to `0` — a confident,
specific, wrong number about the household's money. `average` is
`round(sum / count)`, and `0` when `count` is `0` (not `null`, not a division by zero).

If computing filter-scoped aggregates on every list request is too expensive, say so early:
the alternative is a separate `GET /expenses/summary` taking the same filters, which the FE
can adopt. What does not work is omitting them.

---

## 3. Expenses

### 3.1 The resource

```jsonc
{
  "id": "exp-0042",
  "name": "Sayur & buah pasar",
  "value": 87000,
  "type_id": "type-belanja",
  "source_id": "source-tunai",
  "date_paid": "2026-08-14",
  "paid_by_user_id": "user-002",
  "household_id": "household-001",
  "created_by_user_id": "user-001",
  "updated_by_admin_id": null,
  "created_at": "2026-08-14T14:22:00.000Z",
  "updated_at": null,
}
```

| Field                 | Type            | Required | Notes                                                          |
| --------------------- | --------------- | -------- | -------------------------------------------------------------- |
| `id`                  | string          | ✅       | Opaque. The FE never parses it.                                |
| `name`                | string          | ✅       | 1–100 chars, trimmed. What the member typed. PRD AC1.2         |
| `value`               | integer         | ✅       | **Minor units of the household currency, as an integer.** §3.2 |
| `type_id`             | string          | ✅       | An `/expense-types` id. May reference an archived one.         |
| `source_id`           | string          | ✅       | A `/payment-sources` id. May reference an archived one.        |
| `date_paid`           | `YYYY-MM-DD`    | ✅       | A calendar day, not a timestamp. §3.3                          |
| `paid_by_user_id`     | string          | ✅       | A member id. **May be tombstoned.** §5.1                       |
| `household_id`        | string          | ✅       | Always the caller's household.                                 |
| `created_by_user_id`  | string          | ➖       | Who recorded it — not necessarily who paid. Immutable.         |
| `updated_by_admin_id` | string / null   | ➖       | Which admin last edited it. `null` when never edited. §3.8     |
| `created_at`          | ISO 8601        | ➖       | UTC.                                                           |
| `updated_at`          | ISO 8601 / null | ➖       | `null` when never edited.                                      |

The four optional fields are optional on the FE side because the list route has not always
returned them; the UI degrades to "recorded by whoever paid" when they are absent. Returning
them on both the list and the detail route is preferred.

`created_by_user_id` and `updated_by_admin_id` answer different questions and both are
required by the PRD's audit trail: who logged the expense (immutable) versus which admin
last changed it. Only admins can edit, so collapsing them into one column loses the
accountability the second one exists for.

**`deleted_at` is not on this list on purpose.** It is a server-side column and a
soft-deleted row never reaches a response — see §3.9. Modelling it client-side would invite
a caller to filter on it, which is the server's job.

### 3.2 `value` is an integer in minor units

The FE stores and sends an integer and formats with `Intl.NumberFormat`. For IDR — the
default household currency — the minor unit is the rupiah itself, so `87000` is Rp 87.000.

Do not switch this to a decimal string or a float without saying so: rounding a float sum
across 84 rows produces a total that does not match the rows the member can see, and a
ledger that cannot add up is worse than one that is missing.

### 3.3 `date_paid` is a day, not an instant

The FE groups the tape into day shelves by string equality on this field, and the month rail
indexes it. A timestamp would put two entries from the same evening on different shelves
depending on the reader's timezone. Keep it a `YYYY-MM-DD` date, timezone-free.

### 3.4 `GET /api/v1/expenses`

Query parameters — all optional except as noted:

| Parameter         | Type         | Default     | Notes                                          |
| ----------------- | ------------ | ----------- | ---------------------------------------------- |
| `page`            | int ≥ 1      | `1`         |                                                |
| `limit`           | int 1–500    | `25`        | The FE requests `400` for a month's tape. §3.5 |
| `sort_by`         | enum         | `date_paid` | `date_paid` \| `value` \| `name`               |
| `sort_order`      | enum         | `DESC`      | `ASC` \| `DESC`. **Uppercase.**                |
| `date_from`       | `YYYY-MM-DD` | —           | Inclusive.                                     |
| `date_to`         | `YYYY-MM-DD` | —           | Inclusive.                                     |
| `type_id`         | string       | —           | Exact match.                                   |
| `source_id`       | string       | —           | Exact match.                                   |
| `paid_by_user_id` | string       | —           | Exact match. Accepts a tombstoned member's id. |
| `search`          | string       | —           | Case-insensitive substring of `name`.          |

An unrecognised `sort_by` or `sort_order` must be **rejected with `400 VALIDATION_ERROR`**,
not silently defaulted. Defaulting is how a sort control ends up looking functional while
doing nothing — this exact bug shipped in the FE's mock and went unnoticed for weeks.

`date_from`/`date_to` are inclusive on both ends. The FE's default view is the current
calendar month, sent explicitly rather than left implicit, because the count strip prints
the range it is counting.

Ordering must be **total** — ties broken by a stable secondary key such as `created_at` then
`id`. `date_paid` alone is not unique (a busy day has a dozen rows), and an unstable sort
makes rows appear twice across page boundaries.

Answers `200` with the page envelope from §2.

### 3.5 `limit` and the continuous tape

The expenses screen is a continuous tape, not a paged table: it requests `limit: 400` to
hold a whole month and scrolls. That is why `limit` has a ceiling of 500 rather than 100. If
500 is unacceptable, the FE needs cursor pagination or infinite scroll instead — a decision
to make now, not after the endpoint ships, because the tape's scroll-position tracking and
its `meta.totals` reconciliation both assume one request per view.

### 3.6 `POST /api/v1/expenses`

```jsonc
// Body — the six fields a member types. Everything else is server-assigned.
{
  "name": "Kopi & gorengan",
  "value": 23000,
  "type_id": "type-makan",
  "source_id": "source-tunai",
  "date_paid": "2026-09-04",
  "paid_by_user_id": "user-002",
}
```

Answers `201` with the created resource in `data`, **fully populated** — `id`,
`household_id`, `created_at` and `created_by_user_id` included. The FE writes an optimistic
row and replaces it with this response; a partial body leaves the tape holding a row with
blank fields until the next refetch.

`household_id` is taken from the session, never from the body. A body that carries one
should be rejected (`400 WHITELIST_VALIDATION`) rather than honoured.

**Permissions:** any member may create. Both admins and members.

Validation errors to expect: `name` blank or over 100 chars, `value` not a positive number,
`date_paid` malformed or in the future, `type_id`/`source_id`/`paid_by_user_id` not in this
household.

An **archived** `type_id`/`source_id`, or a **tombstoned** `paid_by_user_id`, must be
rejected on create. New spending cannot be attributed to someone who has left, nor booked
against a retired category — while an _existing_ row may reference all three, which is the
whole reason those rows are kept (§4.1, §5.1). The FE's pickers only offer live options, so
this is a backstop rather than a reachable path.

### 3.7 `GET /api/v1/expenses/:id`

Answers `200` with the resource, `404 NOT_FOUND` otherwise — including when the row belongs
to another household, which must not be distinguishable from a row that does not exist.

### 3.8 `PATCH /api/v1/expenses/:id` — update

**`PATCH` is the update verb across this whole spec.** Decided, not open. The FE sends it
today and the mock answers it, for every update route here: `/expenses/:id`,
`/expense-types/:id`, `/payment-sources/:id`, and `/households/:id/prefs`.

Worth flagging to BE, because it is a departure: the shipped API contains **zero `PUT` and
zero `PATCH` routes** — it models updates as `POST` action routes
(`/console/households/:id/delete`, `/restore`, `/resend-invite`). `PATCH` is chosen here on
the merits rather than for consistency with that: every update in this module is genuinely
partial, and `PATCH` is the verb whose semantics say so. `PUT` implies a full replacement
the FE never sends, and `POST /expenses/:id` describes an action when what is happening is
an edit.

**The body is partial and the three-way distinction is load-bearing:**

| Body                     | Means                 |
| ------------------------ | --------------------- |
| key absent               | leave the field alone |
| key present with a value | write that value      |
| key present with `null`  | clear the field       |

That is not pedantry — it is what makes archive and restore work at all. `archived_at`
carries a date to archive and `null` to restore, so a server that treated absent and `null`
alike would make restore impossible, and one that treated `null` as "no change" would make
archive one-way. See §4.2.

Answers `200` with the full updated resource and a refreshed `updated_at`.

**Permissions: admin only.** Members create and read; only admins change history.

### 3.9 `DELETE /api/v1/expenses/:id` — soft delete

**This is a soft delete.** The row is stamped with `deleted_at` and kept; it is never
removed from the table. Per the PRD, deleted expenses stay recoverable for **30 days**, and
a Phase 2 admin Trash view restores them.

Consequences the server owns, not the client:

- **Every read filters `deleted_at IS NULL`** — list, detail, and the `meta.totals`
  aggregate alike. A tombstoned row that still counted toward the household total would be
  worse than a hard delete, because the figure would disagree with the rows behind it.
- `deleted_at` is never returned. There is no client-visible field and no query parameter
  to include deleted rows; the Trash view will need its own route when it ships.
- A second `DELETE` on an already-deleted row is `404 NOT_FOUND`, the same as an id that
  never existed.

Answers `200` with the envelope and `data: null` — **not `204`**. A body-less success is a
second response contract for the client to carry, and this API wraps everything else.

**Permissions: admin only.** The FE still asks for confirmation, and its copy still says the
action cannot be undone — which matches the PRD's own modal wording, and is honest for as
long as no Trash UI exists to undo it with.

---

## 4. Reference data

The FE calls categories `expense-types` and accounts `payment-sources`, matching the paths.
Neither is paginated: `data` is the whole array, no `meta`.

### 4.1 Two requirements that are not cosmetic

**Archived rows must be returned, not filtered.** `archived_at` exists so a category
survives its own retirement — past expenses keep pointing at it, and the ledger renders it
with an archived marker. The Restore action only renders when `archived_at` is set, so a
list that hides archived rows makes archiving one-way: the row vanishes and the control
meant to bring it back can never appear. Callers that want only live rows narrow
client-side, and the FE already does (`useActiveCategories`, `useActiveAccounts`).

**`order` must be server-assigned and stable.** The FE derives each category's rim colour
from `order` (`rimFor(order)`), which is how a member recognises a category at a glance
across the tape, the rail and the pickers. Two consequences:

- `order` must not shift when a sibling is archived. Assign it as `max(order) + 1` on
  create, never as the current row count — archiving does not renumber, so a count-based
  value eventually collides.
- Deriving colour from array position was a bug the FE already fixed. If `order` is not
  stable, the colours move, which reads as the data having changed.

### 4.2 Category — `/expense-types`

```jsonc
{
  "id": "type-belanja",
  "name": "Belanja",
  "order": 0,
  "archived_at": null,
  "household_id": "household-001",
}
```

| Endpoint                   | Body                              | Permissions |
| -------------------------- | --------------------------------- | ----------- |
| `GET /expense-types`       | —                                 | any member  |
| `POST /expense-types`      | `{ name }`                        | admin only  |
| `PATCH /expense-types/:id` | `{ name?, order?, archived_at? }` | admin only  |

`archived_at` is an ISO date or `null`. Archive is `{ "archived_at": "2026-08-30" }`;
restore is `{ "archived_at": null }`. Because `null` and absent mean different things here, a
rename must send `{ name }` alone — the FE's `toCategoryBody` only writes keys the caller
actually passed, precisely so a rename cannot accidentally restore an archived row.

Name uniqueness within a household: undecided. The FE does not enforce it and will render a
`409 CONFLICT` verbatim if the API does.

### 4.3 Account — `/payment-sources`

```jsonc
{
  "id": "source-debit",
  "name": "Kartu debit BCA",
  "kind": "bank",
  "opening_balance": 12400000,
  "as_of": "2026-05-01",
  "order": 2,
  "archived_at": null,
  "household_id": "household-001",
}
```

| Field             | Type                          | Notes                                                   |
| ----------------- | ----------------------------- | ------------------------------------------------------- |
| `kind`            | `cash` \| `bank` \| `ewallet` | **Lowercase** — unlike `role`, which is upper. Confirm. |
| `opening_balance` | integer, minor units          | Same convention as `value`. May be `0`.                 |
| `as_of`           | `YYYY-MM-DD`                  | The day the opening balance was true.                   |

| Endpoint                     | Body                                                               | Permissions |
| ---------------------------- | ------------------------------------------------------------------ | ----------- |
| `GET /payment-sources`       | —                                                                  | any member  |
| `POST /payment-sources`      | `{ name, kind, opening_balance, as_of }`                           | admin only  |
| `PATCH /payment-sources/:id` | `{ name?, kind?, opening_balance?, as_of?, order?, archived_at? }` | admin only  |

`opening_balance` and `as_of` exist so a real per-account balance becomes derivable later
(opening + income − expense, per account). Nothing computes it yet; the fields are carried
so the data is there when it does.

The lowercase `kind` is worth a decision: `role` is `ADMIN`/`MEMBER` and `household_status`
is `ACTIVE`/`DELETION_PENDING`, so a lowercase enum here is inconsistent with the rest of
the API. The FE follows whichever is chosen — it is one union type.

---

## 5. People — `GET /households/:id/members`

### 5.1 One endpoint, two jobs — and no `/users`

The gap analysis proposed a separate `GET /users` for the ledger's attribution roster. **Do
not build it.** This endpoint serves both:

- **The settings roster** — every member, their role, invite state and tombstone.
- **The ledger's name resolution** — putting a name on `paid_by_user_id`, and the "paid by"
  filter.

Which means: **tombstoned members must be returned, not filtered out.** An expense from
March still points at whoever paid it, and if that person has since left, hiding them here
makes their historical rows resolve to `—`. Attribution has to survive removal. The FE's
mock previously filtered them and that was a latent bug; the real API should not copy it.

The FE narrows client-side over one cached response: the roster is everyone, the "paid by"
picker for a _new_ expense is everyone without a `deleted_at`. Two endpoints would mean two
caches, and a membership write that refreshed only one left the picker a session behind —
which is why they were folded together.

`:id` must equal the household on the session and the `X-Household-ID` header.

### 5.2 The resource

```jsonc
{
  "id": "user-004",
  "name": "Asep",
  "email": "asep@example.com",
  "role": "MEMBER",
  "household_id": "household-001",
  "status": "pending",
  "resend_count": 1,
  "invite_sent_at": "2026-09-03T22:15:00.000Z",
  "invite_expires_at": "2026-09-06T04:15:00.000Z",
  "deleted_at": null,
  "deletion_reason": null,
}
```

| Field               | Type                                       | Notes                                               |
| ------------------- | ------------------------------------------ | --------------------------------------------------- |
| `id`                | string                                     | Matches `paid_by_user_id` on expenses.              |
| `name`              | string                                     | See §5.5 for the placeholder case.                  |
| `email`             | string                                     | ASCII only, per the invite validation.              |
| `role`              | `ADMIN` \| `MEMBER`                        | **Uppercase.** §5.6                                 |
| `status`            | enum                                       | Server-derived. §5.3                                |
| `resend_count`      | integer                                    | Resends spent on the current invite. `0` when none. |
| `invite_sent_at`    | ISO 8601 / null                            | `null` **means delivery failed.** §5.4              |
| `invite_expires_at` | ISO 8601 / null                            | `null` when there is no invite. 48 h TTL.           |
| `deleted_at`        | ISO date / null                            | Tombstone. Never a hard delete.                     |
| `deletion_reason`   | `HOUSEHOLD` \| `LEFT` \| `REMOVED` \| null | Why they are gone.                                  |

`role` and `resend_count` are both required by shipped UI: the remove button is gated on
`role !== ADMIN`, and the resend button renders "Resend · N left" from
`MAX_RESENDS - resend_count`. Neither is on the API's current invite response, and without
them those two controls cannot be drawn correctly.

### 5.3 `status` is server-derived

Per the API's own convention — derived from the latest invite, never stored. The FE
previously recomputed it from `deleted_at`, `deletion_reason` and `invite_pending`; that is
now removed, because the same rule in two places is one place too many.

| `status`         | Meaning                                                          |
| ---------------- | ---------------------------------------------------------------- |
| `joined`         | Active member, no outstanding invite.                            |
| `pending`        | A live, unspent invite exists.                                   |
| `invite_expired` | An invite exists but is past its 48 hours. Resend is the fix.    |
| `no_access`      | Tombstoned because the household is being deleted (`HOUSEHOLD`). |
| `left`           | Tombstoned by their own choice (`LEFT`).                         |
| `removed`        | Tombstoned by an admin (`REMOVED`).                              |

Precedence: a tombstone outranks an invite. Someone removed while their invite was still
live is `removed`, not `pending`.

`invite_expired` is the one addition to the FE's previous vocabulary. It was worth
distinguishing: collapsing it into `pending` gave a member no reason their link had stopped
working, and no cue that resending was the recovery.

Note this list drops `invite_pending` as a separate boolean — it is `status === "pending"`.

### 5.4 `invite_sent_at: null` means delivery failed

An invite row exists but the email never went out. It is a distinct state from "no invite"
(where both timestamps are `null`) and from "expired", and the recovery is different: a
resend, immediately. The FE renders "Invite could not be delivered — resend it" on that row.
Keep the two timestamps separate so the state is representable.

### 5.5 The placeholder row

If a person is ever hard-deleted rather than tombstoned, their expenses still carry their
`paid_by_user_id`. The FE renders a member named exactly `"Former member"` as status
`former` — a client-only status, since it is not a membership state. Either return such a
placeholder row, or guarantee hard deletion never happens; the FE handles both, but silently
dropping the id resolves those rows to `—`.

### 5.6 `role` casing — a live bug this fixes

The FE's `Role` union was `'admin' | 'member'` at the time of the gap analysis, so
`canManageExpenses(role)` compared against `'admin'` and would have been **false for every
admin**, silently reducing every admin to member permissions. The FE now uses
`ADMIN`/`MEMBER` throughout. Do not send lowercase.

### 5.7 `POST /api/v1/households/:id/members` — invite

```jsonc
// Body
{ "name": "Nadia", "email": "nadia@example.com" }
```

Answers `201` with the created member, `status: "pending"`, `resend_count: 0`, and both
invite timestamps populated. The FE appends it to the list immediately — they appear as
pending straight away and become `joined` once they spend the link.

**Permissions: admin only.** Also refused while the household is in its deletion grace
period.

| Failure                                  | Status | Code                         | Notes                                                |
| ---------------------------------------- | ------ | ---------------------------- | ---------------------------------------------------- |
| `name` blank                             | 400    | `VALIDATION_ERROR`           |                                                      |
| `email` not a valid ASCII address        | 400    | `VALIDATION_ERROR`           | The FE validates inline first; this is the backstop. |
| Address already in **this** household    | 409    | `CONFLICT`                   | Wording differs per case — rendered verbatim.        |
| Address already in **another** household | 409    | `CONFLICT`                   | "Ask them to leave it first, then invite again."     |
| Rate limited                             | 429    | `TOO_MANY_REQUESTS`          |                                                      |
| Household scheduled for deletion         | 403    | `HOUSEHOLD_DELETION_PENDING` | `details.deletion_scheduled_for`                     |

The two 409s are the reason `error.message` is rendered verbatim: telling someone their
address is taken when the real problem is that they are in a different household invites a
retry that can never work.

### 5.8 `POST /api/v1/households/:id/members/:memberId/resend-invite`

No body. Answers `200` with the updated member: `resend_count` incremented, both invite
timestamps re-stamped, `invite_expires_at` pushed 48 hours out.

Valid on `pending` **and** `invite_expired` — an expiry is the state resending exists for.

**Permissions: admin only.**

| Failure                              | Status | Code                | Notes                        |
| ------------------------------------ | ------ | ------------------- | ---------------------------- |
| Ration spent (3 per invite)          | 429    | `TOO_MANY_REQUESTS` | **429, not 409.** See below. |
| Member has no invite / is tombstoned | 409    | `CONFLICT`          | Nothing to resend.           |
| No such member in this household     | 404    | `NOT_FOUND`         |                              |

**The exhausted-ration status is 429.** The FE's mock answered `409` and its copy was wired
to that branch — a status this route never sends, so the "Max resends reached" message would
never have appeared against the real API. Fixed in this pass. `MAX_RESENDS` is 3, matching
the API's documented per-invite ration; the FE renders the remaining count from
`resend_count` rather than counting in component state, which reset on reload.

### 5.9 `DELETE /api/v1/households/:id/members/:memberId`

Answers `200` with the tombstoned member: `deleted_at` set, `deletion_reason: "REMOVED"`,
both invite timestamps cleared, `status: "removed"`.

**Tombstone, never a hard delete** — §5.1.

**Permissions: admin only.**

| Failure                       | Status | Code        | Notes                                            |
| ----------------------------- | ------ | ----------- | ------------------------------------------------ |
| Target is the household admin | 409    | `CONFLICT`  | The FE hides the control, so this is a backstop. |
| Target is the caller          | 409    | `CONFLICT`  | Leaving is `POST /auth/leave-household`.         |
| No such member                | 404    | `NOT_FOUND` |                                                  |

---

## 6. Open decisions

Ordered by how expensive they are to change after the endpoints ship.

| #   | Decision                                                              | Default assumed here                             | Cost of changing later                               |
| --- | --------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| 1   | `meta.totals` on `GET /expenses` (§2.1)                               | Present, filter-scoped                           | High — three shipped surfaces have nothing to render |
| 2   | `limit` ceiling of 500 (§3.5) — **PRD specifies a paged table, §7.2** | 500, one request per month                       | High — the tape becomes cursor-paginated, a redesign |
| 3   | `value` as integer minor units (§3.2) — **PRD says decimal, §7.2**    | Integer                                          | High — every stored row needs migrating              |
| 4   | ~~`PUT` vs `POST` for updates~~ — **decided: `PATCH`** (§3.8)         | `PATCH`, sent by the FE and answered by the mock | Low — one verb per FE api module                     |
| 5   | `kind` lowercase vs uppercase (§4.3)                                  | Lowercase, as the FE has it                      | Low — one union type                                 |
| 6   | Category/account name uniqueness (§4.2)                               | Not enforced                                     | Low — the FE renders a 409 verbatim already          |
| 7   | Hard-delete placeholder rows (§5.5)                                   | Tombstones only; placeholder handled             | Low — FE handles both                                |

Not covered here, and still needed before the module is complete:
`GET|PATCH /households/:id/prefs` (currency and `month_start_day`), and the household
lifecycle banner. Both are in [`API-GAP-ANALYSIS.md`](API-GAP-ANALYSIS.md) §4.1 and §6.5.

---

## 7. Reconciliation with `MASTER_PRD_EXPENDITURE`

Audited 2026-09-05 against `notes/MASTER_PRD_EXPENDITURE.md` (v3.0, dated 2026-07-22).

The PRD predates auth v3.1 and predates this frontend, so where the two disagree it is
usually because the PRD is describing a world that has since changed. This section says
which side wins for each disagreement, so BE is not left holding two documents and no
tiebreaker.

**Four things changed in this spec as a result of the audit** (§7.1). **Three are genuine
conflicts still needing a decision** (§7.2). The rest is the PRD being out of date (§7.3) or
a frontend gap that is not the API's problem (§7.4).

### 7.1 Where the PRD was right and this spec was wrong — now fixed

| PRD                                         | Was                                      | Now                                                                                                                              |
| ------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| AC4.4, AC4.8 — soft delete, 30-day recovery | §3.9 specified a **hard** delete         | §3.9 rewritten: `deleted_at` stamp, every read filters it, `meta.totals` excludes it. The mock soft-deletes and a test covers it |
| Data model, AC3.4 — `updated_by_admin_id`   | Absent from the resource                 | Added to §3.1 and to `WireExpense`. Distinct from `created_by_user_id`, as the audit trail requires                              |
| AC1.2, field table — name max **100**       | §3.1 said 1–120                          | Corrected to 100. The FE form now carries `maxLength={100}`, which it did not                                                    |
| "Paid By dropdown only shows active users"  | §3.6 validated household membership only | §3.6 now rejects a tombstoned `paid_by_user_id` (and an archived type/source) on create                                          |

### 7.2 Genuine conflicts — a decision is needed

#### 1. `value`: integer vs decimal — **the significant one**

|                  |                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| **PRD**          | `value: Decimal (required, must be > 0, precision 10,2)`. AC1.4: _"decimals allowed (e.g., 50000.50 IDR)"_ |
| **This spec**    | §3.2 — integer in minor units                                                                              |
| **The FE today** | Integer. `min: 1` on the amount field, no `step`, `Math.round` throughout the optimistic-totals maths      |

These cannot both be true, and this is open decision #3 — the most expensive one to reverse,
because it is a stored-column migration rather than a code change.

The PRD's own example undercuts itself: `50000.50 IDR` is not a real amount. The rupiah has
no circulating sub-unit, and the PRD elsewhere names IDR as the base currency and defers
multi-currency to Phase 2. A `DECIMAL(10,2)` column also caps the household at
99,999,999.99 — plausible to hit in IDR within a few years of rent and school fees.

**Recommendation: integer minor units, and update the PRD.** If BE wants headroom for a
future currency that does have sub-units, `DECIMAL(14,2)` stored but transported as an
integer count of minor units is a reasonable hedge — but the wire type must be settled now,
because the FE's rounding and the `meta.totals` sum both depend on it.

#### 2. List view: paginated table vs continuous tape

|                  |                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| **PRD**          | AC2.1–AC2.4 — a **table** with sortable column headers, _"25 per page default, with page navigation"_ |
| **This spec**    | §3.5 — `limit` up to 500; the FE requests 400 and scrolls                                             |
| **The FE today** | A continuous month-long tape grouped into day shelves, with a month rail. No page navigation exists   |

The frontend deliberately built something other than what the PRD specified. The spec's
default is still 25, so the API serves both — but BE should know that no client currently
sends `page > 1`, and that the 500 ceiling exists solely for the tape.

**This is a product decision, not an API one.** It needs an owner either way: either the PRD
is updated to describe the tape, or the tape is wrong and the FE owes a table.

#### 3. Sortable columns

|                  |                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------- |
| **PRD**          | AC2.1 lists six columns; AC2.3: _"User can click column headers to sort"_ — implying all six |
| **This spec**    | §3.4 — `sort_by` accepts `date_paid`, `value`, `name` only                                   |
| **The FE today** | Three, matching the spec. And no clickable headers at all, because there is no table         |

Sorting by `type_id` / `source_id` / `paid_by_user_id` would sort by opaque id, not by the
name a member sees — so it needs a join and a documented collation to be worth anything.

**Recommendation: leave it at three.** Sorting a ledger by category name is a weak use case
next to filtering by it, which is already supported. If BE builds the other three anyway,
say so and the FE will surface them.

### 7.3 Where the PRD is out of date — this spec wins

No action for BE beyond knowing the PRD statement is stale.

| PRD says                                                                                     | Reality                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `role: Enum ('admin','member')` — lowercase                                                  | Auth v3.1 ships `ADMIN` / `MEMBER`. §5.6. Lowercase would silently reduce every admin to member permissions                                                                                                                                                                                                                 |
| `users.is_active` boolean, [Deactivate] / [Reactivate]                                       | Replaced by `deleted_at` + `deletion_reason`. **The PRD flags this collision itself** (its own note of 2026-08-27) and says _"do not implement either flow until this is decided"_ — §5 of this spec **is** that decision, resolving it the way the PRD predicted: `REMOVED` is deactivation, and re-invite is reactivation |
| `POST /auth/login` with `password_hash`, password reset email                                | Auth is passwordless magic-link. Out of this module's scope; noted so nobody builds a password field                                                                                                                                                                                                                        |
| Deactivated members _"still parked in this household awaiting a [Reactivate] click"_         | Removal frees the email immediately — the person may already be in another household, so reactivation is a re-invite that can 409                                                                                                                                                                                           |
| Search debounce **3s** (AC2.7 and Performance)                                               | The FE uses **300ms**. A 3-second debounce reads as a broken search box; this is almost certainly a typo for 300ms in the PRD                                                                                                                                                                                               |
| `PUT /api/expenses/:id` (Backend Development §9)                                             | `PATCH`. §1.4, §3.8                                                                                                                                                                                                                                                                                                         |
| _"Verify no duplicate (name + value + date + paid_by within 1 day)"_ under server validation | The PRD's own Non-Goals defer duplicate detection to Phase 2, and its Phase 2 list specifies it as a **warning**, not a rejection. Do not build a server-side duplicate block                                                                                                                                               |

### 7.4 PRD requirements this spec does not serve — and why

| PRD                                                              | Status                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC2.8 — total sum of filtered expenditures above the table       | ✅ Served by `meta.totals` (§2.1). **This upgrades §2.1 from a frontend assertion to a PRD requirement** — it is not negotiable                                                                                                                                                    |
| AC1.9 — empty Type/Source dropdown state with a link to Settings | Frontend concern. The API's part is only to return `[]`, never a 404, for an unconfigured household                                                                                                                                                                                |
| AC3.x — the whole Edit Expenditure story                         | **The FE has no edit UI at all.** No `useUpdateExpense`, no form, no [Edit] button — only create and delete. `PATCH /expenses/:id` is specified and mocked, and nothing calls it. This is the largest gap between the PRD and the shipped frontend, and it is FE work, not BE work |
| AC4.8 / Phase 2 — admin Trash view with [Restore]                | Out of scope. Needs its own route; §3.9 has no "include deleted" parameter by design                                                                                                                                                                                               |
| "Cannot delete a Type while expenses reference it"               | Satisfied structurally: **there is no delete route for `/expense-types`** (§4.2), only archive. The reference check the PRD asks for cannot be reached                                                                                                                             |
| Audit logging with before/after values                           | BE-internal. Not a wire concern, but the PRD asks for it and this spec does not mention it                                                                                                                                                                                         |
| Concurrency / optimistic locking                                 | Not specified. `PATCH` with partial bodies makes this field-level last-write-wins, which is the PRD's stated fallback. Add `If-Match`/version only if two admins editing one row turns out to be real                                                                              |
| `month_start_day`, per-account balances                          | Carried but uncomputed — see the closing note below                                                                                                                                                                                                                                |

### 7.5 One thing the PRD asks for that nobody has scoped

The PRD's **Users table** still carries `password_hash` and `last_login`, and its Workflow 0
describes a Console-generated invite with a 7-day expiry. Auth v3.1 uses 48 hours (§5.2) and
no password. These are auth's business, not this module's, but the two documents disagree
and somebody should retire the older text before a backend engineer implements from it.
