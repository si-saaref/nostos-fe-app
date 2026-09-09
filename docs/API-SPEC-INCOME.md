# Income — API contract: what exists, what is missing

**Derived, not guessed.** The provided column comes from
`notes/Postman/nostos-api.postman_collection.json` (generated from the backend's own
controllers and OpenAPI document — 35 requests, 16 member-facing) and from the live probes in
`notes/BE/CUTOVER-2026-09-07.md`. The consumed column comes from grepping every
`apiClient.*` call in `src/`.

Last derived: 2026-09-08. Backend on this machine: `http://localhost:4040`.

---

## 0. Summary

|                                                          |                                                      |
| -------------------------------------------------------- | ---------------------------------------------------- |
| Member-facing endpoints the BE serves                    | **16** (+ `/health`, + 10 `/console/*` out of scope) |
| Endpoints this app calls                                 | **21**                                               |
| Calls that hit a real endpoint                           | **16**                                               |
| **Endpoints the income surface needs and does not have** | **8**                                                |
| Other endpoints the app calls and does not have          | **2** (household prefs)                              |

The income module has **no backend at all**. Not "shapes differ" — there is no `/income`,
no `/income-types` and no `/positions` route of any kind. Everything income needs from
_existing_ endpoints is already there and already correct.

---

## 1. Already provided — and income needs no change to any of them

Verified live (`401` on an unauthenticated probe = route exists and the guard reached it).

| Method                      | Path                                                                                            | Income uses it for                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| GET                         | `/api/v1/payment-sources`                                                                       | **Load-bearing.** Source name, `kind`, `order` (the rim), `opening_balance`, `as_of`. The from/to pickers and every route pill. |
| POST · PATCH                | `/api/v1/payment-sources`, `/:id`                                                               | Admin adds/archives a source in Settings; income reads the result.                                                              |
| GET                         | `/api/v1/households/:id/members`                                                                | "Recorded by" on every row, including tombstoned members.                                                                       |
| GET                         | `/api/v1/auth/me`                                                                               | `household_id`, `role` — gates edit/delete.                                                                                     |
| GET · POST · PATCH · DELETE | `/api/v1/expenses`, `/:id`                                                                      | Not called by the income UI. Listed because **`/positions` must read this table server-side.**                                  |
| GET · POST · PATCH          | `/api/v1/expense-types`, `/:id`                                                                 | Not used by income.                                                                                                             |
| POST                        | `/api/v1/auth/signin`, `/logout`, `/leave-household`, `/change-email`                           | Session only.                                                                                                                   |
| GET                         | `/api/v1/auth/signin/:token`, `/claim/:token`, `/invite/:token`, `/confirm-email-change/:token` | 302s, session only.                                                                                                             |
| POST · DELETE               | `/api/v1/households/:id/members`, `/:memberId`, `/:memberId/resend-invite`                      | Settings only.                                                                                                                  |

**`payment_sources.opening_balance` and `as_of` already exist** and were added during
Expenditure explicitly for income to use (income PRD §5). That is the single most important
"already provided" fact here: the balance formula has its starting point.

---

## 2. Needed from BE — the eight income routes

Nothing below exists. Ordered by what blocks what.

### 2.1 The income ledger — 4 routes, blocks everything

```
GET    /api/v1/households/:id/income?page=&limit=&date_from=&date_to=
POST   /api/v1/households/:id/income
PATCH  /api/v1/households/:id/income/:incomeId
DELETE /api/v1/households/:id/income/:incomeId
```

Row shape, snake_case, `data` is the resource and never a wrapper:

```json
{
  "id": "uuid",
  "household_id": "uuid",
  "from_source_id": "uuid | null",
  "to_source_id": "uuid",
  "amount": 8600000,
  "type": "gaji",
  "name": "Gaji bulan ini",
  "date": "2026-09-01",
  "created_by_user_id": "uuid",
  "created_at": "2026-09-01T03:12:00.000Z",
  "updated_by_admin_id": "uuid | null",
  "updated_at": "2026-09-01T03:12:00.000Z | null"
}
```

Non-negotiables the frontend is built against:

- **`from_source_id` is nullable and null is a value, not an omission.** `null` means the
  money came from outside the household. It is sent explicitly on POST and is the one field
  PATCH may clear (three-way: absent = leave, value = write, `null` = clear). A `null` on any
  other field is a `400`.
- **`type` is a `VARCHAR`, not a foreign key** (income PRD §5). The row stores the word.
- **`date` is a calendar day**, `YYYY-MM-DD`, never a timestamp.
- **`amount` is a JSON number**, `DECIMAL(14,2)`. A third decimal place is a **rejection, not
  a rounding** — `10.999` is a `400`, never `11.00`.
- **`meta.pagination` on every list, even an empty one.** A page past the end is
  `data: []` with real totals, never a `404`.
- **`meta.totals.sum` is net inflow**: `sum(to) − sum(from)`. A transfer contributes to both
  halves and therefore cancels. This is what makes the figure mean "money the household
  gained" — the whole strip is built on it, and a gross sum would silently overstate every
  month by the size of its transfers.
- Default order **`date DESC`**, id as tiebreak. Sorting and filtering are deferred, so this
  order _is_ the contract.
- Soft delete, 7-day window. `deleted_at` never on the wire. A second `DELETE` is a `404`,
  indistinguishable from a row that never existed.
- `DELETE` answers `200` with `data: null`, not `204` — one envelope for every route.
- `household_id` in the body is `400 WHITELIST_VALIDATION`.

Error codes the UI maps onto fields:

| Code                   | Status | Lands on                                                                                                                   |
| ---------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_SOURCE`       | 422    | `to_source_id` — archived or foreign source                                                                                |
| `SAME_SOURCE`          | 400    | `to_source_id` — `from == to`. **Not in any AC**; the PRD's own review flags it. Money cannot move to where it already is. |
| `FUTURE_DATE`          | 400    | `date` — through tomorrow UTC allowed                                                                                      |
| `VALIDATION_ERROR`     | 400    | `details[]`, one row per field                                                                                             |
| `WHITELIST_VALIDATION` | 400    | summary line                                                                                                               |
| `FORBIDDEN`            | 403    | PATCH/DELETE by a non-admin — enforced server-side, not just hidden in the UI                                              |

### 2.2 Income types — 3 routes, blocks the create form

```
GET    /api/v1/income-types
POST   /api/v1/income-types
PATCH  /api/v1/income-types/:id
```

```json
{ "id": "uuid", "name": "gaji", "archived_at": null, "household_id": "uuid" }
```

- `UNIQUE(household_id, name)`, **case-insensitive** → `409 DUPLICATE_NAME`. "Gaji" and
  "gaji" are one word to the family that typed them, and two rows would split their history.
- Archive via `PATCH archived_at`, never `DELETE`. Old entries keep pointing at the word that
  was true when they were recorded.
- Simpler than `expense_types`: no colour, no `order`.

### 2.3 Positions — 1 route, blocks the position card

```
GET /api/v1/households/:id/positions?as_of=YYYY-MM-DD&from=YYYY-MM-DD

data: [{ "source_id": "uuid", "opening_balance": 3000000, "balance": 29290000 }]
```

**This is the one figure the frontend cannot compute and must not fake.**

```
balance(source, upTo) =
    payment_sources.opening_balance
  + Σ income  WHERE to_source_id   = source AND date      BETWEEN as_of AND upTo
  − Σ income  WHERE from_source_id = source AND date      BETWEEN as_of AND upTo
  − Σ expense WHERE source_id      = source AND date_paid BETWEEN as_of AND upTo
  (deleted_at IS NULL throughout)
```

- `opening_balance` in the response = `balance(source, from − 1 day)`. That is what makes
  "opened September at" and "closed August at" one number instead of two a day apart.
- `balance` = `balance(source, as_of)`.
- Rows **before** `payment_sources.as_of` are already inside the opening balance and must not
  be counted twice.
- **A complete collection, not a page** — one row per source, shaped like
  `/payment-sources`. That is the only reason the client may sum its totals and kind
  subtotals: it provably holds every term. Every paginated aggregate is guarded instead.
- **Return archived sources that still hold money.** They are history with a balance, and
  dropping them makes the household total disagree with its own parts.
- **Do not clamp at zero.** A source can genuinely be short; a floor would report a
  comfortable `Rp 0` for an account that is overdrawn (income PRD §Risks).
- Period movement is `balance − opening_balance`, derived client-side. The response stays two
  figures wide on purpose.

Why it cannot live in the frontend: a balance needs every income and expense the household
has _ever_ recorded, across all months. A wide fetch is exactly right for a new household and
silently wrong for an old one — the worst way for a money figure to fail. `PositionCard`
therefore renders a stated degraded band on error: no number, a plain sentence, and the
statement below still complete. Never a guessed balance, never a zero standing in for an
unknown.

---

## 3. Other gaps, not income's

| Method      | Path                           | Status                                                                                                                                                                                                   |
| ----------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET · PATCH | `/api/v1/households/:id/prefs` | **404 confirmed** (cutover probe). Settings shows "belum tersedia di server". Blocks per-household currency and timezone, which in turn blocks proper multi-currency and timezone-aware date validation. |

---

## 4. Working locally until §2 exists

`src/mocks/handlers/index.ts` holds one flag for the whole financial world:

```ts
export const MOCKED: MockedDomains = {
  auth: false, // live
  financial: true, // expenses + income + catalogue + positions
  prefs: true, // route not built
}
```

`financial` is deliberately **one** domain rather than separate `expense` and `income` flags,
because the two cannot be split:

1. Both ledgers point at the same `/payment-sources` and `/members`. Mock income rows carry
   fixture source ids; live rows carry the server's. Mock one ledger against the other's
   catalogue and every source on screen resolves to an em dash — which is exactly the bug
   this file was written after.
2. A position spans both ledgers at once, so a live-expense / mock-income world cannot
   produce a correct balance for any source. Not "slightly off" — structurally unanswerable.

So the whole financial surface is stubbed today, and it flips to live in one edit once §2
ships. Expenses would run live on their own and did between 2026-09-07 and 2026-09-08; they
ride with income until income has a backend.

The mock is not a sketch: `src/mocks/handlers/positions.ts` implements the balance formula
above against both fixture ledgers, including the `as_of` window and the no-clamp rule, so
the numbers on screen in development are the numbers the real endpoint should produce.
