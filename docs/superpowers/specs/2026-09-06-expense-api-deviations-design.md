# Expense API Deviations — Design

**Date:** 2026-09-06
**Status:** Approved (design), pending implementation plan
**Branch:** `feat/integrate-expense`
**Source docs:** `notes/BE/API-SPEC-DEVIATIONS.md` (2026-09-06),
`docs/API-SPEC-FINANCIAL.md` §1.3 / §3.6 / §4.3 / §6

## 1. Goal

Reconcile the frontend with the eight deviations backend reported against
`docs/API-SPEC-FINANCIAL.md`. Five need code; three do not.

The note's framing and our code disagree in three places, and those
disagreements are most of the work:

- Deviation #2 calls `kind` "one union type". It is not — `AccountKind` is
  currently doing double duty as both the wire type and the domain type, so
  uppercasing it in place would push `CASH` into the settings radio group.
- Deviation #3 (member statuses) is already done. `WireMemberStatus` has read
  `joined | pending | invite_expired | no_access | left | removed` since the
  settings module landed. What is _not_ handled is the new `403` on invite.
- Deviation #5 is filed under "worth checking" but is a live bug:
  `deletionDeadlineFromResponse` reads `data.details`, backend sends
  `data.error.details`, and the deletion modal opens with no date.

**In scope:** field-level errors on the expense form, the `kind` wire/domain
split, the `error.details` nesting fix, the invite `403`, and removing the dead
decimal-era money constants.

**Out of scope:** the `date_paid` relaxation (#7 — see §3), anything touching
the `value` integer-vs-decimal question (§7.2 of the API spec, unresolved), and
the app-auth side of the member-status cutover.

## 2. Starting Point

| Deviation                     | Note says                  | Our code today                                                                                                                                | Verdict                 |
| ----------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| #1 `422`, no `details[]`      | needs a field-error branch | `ExpenseForm.tsx:172` renders one `getErrorMessage` line for every server error; `details[]` is never read anywhere                           | real gap                |
| #2 `kind` uppercase           | "one union type"           | `AccountKind` (`types/catalog.ts:21`) is wire _and_ domain; `toAccount` passes it through; `AccountSection.tsx:60-62` binds the same literals | real, larger than filed |
| #3 member statuses            | coordinated cutover        | statuses already correct; invite `403` and resend `409` unhandled                                                                             | partly done             |
| #4 `error.status_code`        | probably nothing           | `unwrap` never reads it; `getErrorMessage` reads `error.message`                                                                              | no change               |
| #5 `details` omitted / nested | "must survive `undefined`" | `signin.ts:66` reads `data.details`; mock serves it top-level                                                                                 | live bug                |
| #6 `value` cap widened        | drop the client ceiling    | expense form has `min: 1`, no ceiling; the stale ceiling lives in unused `utils/money.ts`                                                     | cleanup only            |
| #7 `date_paid` +1 day         | relaxation                 | `max={today}` plus a `validate`                                                                                                               | leave as-is             |
| #8 `deleted_at` full ISO      | relaxation                 | `deletedAt: string \| null`, only null-checked                                                                                                | no change               |

## 3. Decisions

| Topic                          | Decision                                                                  | Reason                                                                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where envelope readers live    | **`src/utils/errors.ts`**, beside `getErrorMessage`                       | That file already owns "how to read the error envelope". One place to survive both `details` nestings.                                                                                   |
| Where the code→field map lives | **`src/modules/financial/lib/expenseErrors.ts`**                          | The codes are per-resource and the field names are the form's. Putting it in `useCreateExpense` would make the api layer know form field names, which it currently does not.             |
| Field error UX                 | `setError`, cleared on edit; summary line suppressed when a field matched | Matches how the form renders its own validation errors. A field error plus a summary says the same thing twice.                                                                          |
| Clearing on edit               | Explicit `clearErrors(name)` in the three Selects' `onChange`             | RHF does not auto-clear a `setError` error under the default `onSubmit` mode. Three one-line wrappers, no mode change.                                                                   |
| `field` → form name            | **Lookup record**, not a snake→camel transform                            | Same reasoning as `SORT_COLUMN` (`expenses.ts:38`): a transform happily "translates" a typo into a field that does not exist.                                                            |
| `kind`                         | Split `WireAccountKind` (upper) from `AccountKind` (lower)                | Keeps the domain and every consumer camel/lowercase, consistent with every other wire/domain pair in the repo.                                                                           |
| Invite `403`                   | Verbatim message **+ the date**, no modal                                 | The invite form is already hidden when `householdActive` is false (`MemberSection.tsx:66`), so the 403 is a race — a member with Settings open when deletion starts — not a normal path. |
| Resend `409`                   | No component change                                                       | Already renders verbatim through `actionError`. Mock cases only, so it is exercisable.                                                                                                   |
| `date_paid` (#7)               | **Not relaxed**                                                           | A Jakarta member is UTC+7; their local today is never ahead of tomorrow UTC, so the relaxation buys nothing and `max={today}` keeps the picker honest.                                   |
| `utils/money.ts`               | Delete the dead decimal constants                                         | `DECIMAL(10,2)` and `MONEY_MAX = 99_999_999.99` contradict our own §3.2 integer-minor-units convention. Only `sumMoney` is imported anywhere.                                            |

## 4. Changes

### 4.1 Envelope readers — `src/utils/errors.ts`

Three additions beside `getErrorMessage`, all tolerant of `undefined`:

- `getErrorCode(error): string | undefined` — `data.error.code`.
- `getErrorDetails(error): unknown` — `data.error.details ?? data.details`.
  The fallback is not hedging: the mock and the shipped signin path both use
  the flat shape today, and both move in this change. The fallback keeps a
  stale deployment of either from opening a dateless modal.
- `getFieldErrors(error): ApiFieldError[]` — `getErrorDetails` when it _is_ an
  array, else `[]`. `ApiFieldError` already exists in `types/api.ts`.

### 4.2 Expense error map — `src/modules/financial/lib/expenseErrors.ts` (new)

```
INVALID_TYPE   → typeId
INVALID_SOURCE → sourceId
INVALID_USER   → paidByUserId
```

One exported function, `expenseFieldErrors(error): { field: keyof CreateExpenseInput; message: string }[]`,
covering both shapes:

1. The `422` codes above — no `details[]`, so the field comes from the code and
   the message from `error.message`.
2. `VALIDATION_ERROR` — one entry per `details[]` row, `field` resolved through
   a snake→form lookup record (`date_paid → datePaid`, `type_id → typeId`,
   `source_id → sourceId`, `paid_by_user_id → paidByUserId`, `name`, `value`).

Unrecognised codes and unrecognised `field` values yield no entry, which is
what routes them to the summary line rather than silently dropping them.

### 4.3 `ExpenseForm.tsx`

`onSubmit`'s `createExpense` call gains an `onError` that runs
`expenseFieldErrors` and applies `setError(field, { type: 'server', message })`
for each. The bottom alert's condition becomes "there is an error _and_ nothing
mapped to a field". The three `Controller` Selects wrap `field.onChange` to
call `clearErrors(name)` first.

### 4.4 `kind` — `types/catalog.ts`, `settings/api/accounts.ts`, mocks

- `WireAccountKind = 'CASH' | 'BANK' | 'EWALLET'`; `AccountKind` unchanged.
- `WireAccount.kind: WireAccountKind`.
- Two lookup records in `accounts.ts`; `toAccount` maps down, the create body
  and `toAccountBody` map up.
- `mocks/handlers/accounts.ts` maps at its `toWire` and body-parsing edges
  (handler default becomes `'CASH'`). `mocks/fixtures/accounts.ts` is **not**
  touched: it is typed `Account[]`, the domain type, so it stays lowercase.
- `AccountSection.tsx` untouched.

### 4.5 `error.details` nesting

- `deletionDeadlineFromResponse` (`signin.ts:60`) uses `getErrorDetails`.
- `mocks/handlers/auth.ts:36-47` moves `details` inside `error`.

### 4.6 Invite `403`

`MemberSection.tsx`'s `inviteError` block appends the
`deletion_scheduled_for` date from `getErrorDetails` when present. The message
itself stays verbatim. A mock case for the `403`.

The resend `409` needs no work: `mocks/handlers/members.ts:120` already answers
`409 CONFLICT` for both a tombstoned member and an accepted invite, and
`MemberSection` renders it verbatim through `actionError`. The only change worth
making is splitting the two cases' shared message in the mock, since §5.7 makes
per-case wording the feature.

### 4.7 `utils/money.ts`

Remove `MONEY_MAX`, `MONEY_MIN`, `MONEY_STEP`, `MONEY_DECIMALS`,
`isValidMoney`, `averageMoney`, and their tests. Keep `sumMoney` and
`roundMoney` (its dependency). Update the file's header comment, which
currently documents the decimal convention as if it were current.

## 5. Testing

| Unit                   | Cases                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `utils/errors.ts`      | code and message read from the envelope; `details` at `error.details`; `details` at the top level; `details` absent; `details` an object rather than an array (yields `[]`)       |
| `expenseErrors.ts`     | each of the three `422` codes → its field; a `VALIDATION_ERROR` with two `details[]` rows; an unknown code → `[]`; an unknown `field` → skipped                                   |
| `ExpenseForm.test.tsx` | each `422` code puts the server message under the right Select and leaves the summary line absent; changing that Select clears it; an unmapped error still shows the summary line |
| `accounts.test.tsx`    | uppercase wire `kind` becomes lowercase domain; create sends uppercase                                                                                                            |
| `signin.test.ts`       | deadline read from both nestings; `403` with no `details` → `null`                                                                                                                |
| `members`              | invite `403` renders the message and the date                                                                                                                                     |

## 6. Risks

- **The `422` codes are unverified against a running backend.** They come from
  the note, not from a response we have seen. The unknown-code path falls
  through to the summary line, so a wrong guess degrades to today's behaviour
  rather than swallowing the error.
- **`kind` is a coordinated cutover.** Between deploying this and backend
  shipping uppercase, `toAccount` receives a lowercase value that is not in
  `WireAccountKind`. The mapping record must fall back to the input rather than
  to `undefined` — an account whose `kind` is `undefined` renders an unselected
  radio group in Settings.
- **Deviation #3's app-auth half is not ours.** This spec changes nothing about
  the member status union; if app-auth calls those routes today, the cutover
  still needs coordinating outside this branch.
