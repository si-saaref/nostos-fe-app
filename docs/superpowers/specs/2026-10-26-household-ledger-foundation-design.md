# Household ledger foundation — cross-stack design

Status: approved 2026-10-26. Compatibility-first approach and the cross-stack
scope were approved by the product owner in conversation.

Related review: `docs/ux-audit.md`.

## Outcome

A newly created household can immediately record an expense or external income
without visiting Settings. The backend owns every financial invariant; the
frontend presents those rules without asking the member to understand the data
model.

The change is large at the domain and API-contract level, but it is not a
rewrite. The existing expense ledger, income ledger, explicit transfer kind,
positions query, balance-adjustment ledger, authentication, tenancy guards and
CRUD services remain the foundation.

## Product decisions locked by this design

- Every household has one protected default Cash account and one protected
  default Bank account.
- Additional Cash and Bank accounts are allowed. This supports, for example,
  cash separately held by two family members.
- The Settings UI has two creation actions: **Add Cash** and **Add Bank
  Account**. It has no generic Add Account flow and no Kind field.
- Account kind remains a backend domain attribute. The chosen action supplies
  it; the member is never asked to choose it a second time.
- Default accounts may be renamed and reconciled, but may not be archived,
  deleted or changed to another kind.
- New accounts may start today or in the past, never in the future.
- A balance correction is effective today. The member does not choose a
  correction date.
- Transfers move money between accounts and never require an Income Category.
- Household creation provisions ready-to-use Income and Expense Categories.
- Compact member selectors use last name. Duplicate or legacy names receive a
  deterministic disambiguator; nickname is future scope.
- Expense and Income headers both show the current total household balance.
- Theme and language are personal/device preferences. Currency, accounting
  period and timezone are household accounting preferences.
- New product flows offer Cash and Bank only. Existing EWALLET rows remain
  readable during the compatibility period; this project does not silently
  rewrite or delete their history.

## Ownership boundary

The backend owns:

- creation and protection of defaults;
- category and account semantic identity;
- valid account kinds and immutable account kind;
- future-date validation using the household timezone;
- transfer consistency;
- balance reconciliation and its resulting delta;
- current per-account and household balances;
- name fields and member identity;
- household accounting preferences.

The frontend owns:

- choosing which explicit action the member sees;
- visual icons mapped from stable semantic keys;
- information hierarchy, responsive composition and interaction states;
- theme and language when stored only on the current device;
- query caching and showing mutations only after confirmed success.

Summing ledger pages or calculating a reconciliation delta in the browser is
not allowed. Formatting an already authoritative backend total is presentation,
not business logic.

## Default household data

Household creation provisions all defaults in the same database transaction as
the household and first admin. A failure rolls back the whole creation.

### Accounts

| system key     | initial display name | kind   | opening balance |
| -------------- | -------------------- | ------ | --------------: |
| `DEFAULT_CASH` | Cash                 | `CASH` |               0 |
| `DEFAULT_BANK` | Bank                 | `BANK` |               0 |

Their `as_of` is the household-local creation date.

### Income Categories

1. Gaji
2. Bonus
3. Usaha
4. Freelance
5. Hadiah
6. Reimburse
7. Pemasukan Lainnya

### Expense Categories

1. Makan & Minum
2. Belanja Dapur
3. Transportasi
4. Tagihan
5. Tempat Tinggal
6. Belanja
7. Kesehatan
8. Hiburan
9. Pendidikan
10. Hadiah & Donasi
11. Langganan
12. Lainnya

Default categories are ready-to-use but are not protected like default
accounts. Admins may rename or archive them. Their immutable semantic key stays
attached so a rename does not change their icon or historical identity.

## Backend data model

### Household preferences

Add household-owned fields, either directly on `households` or in a one-to-one
preferences table:

- `currency`, default `IDR`;
- `month_start_day`, default `1`, valid 1–28;
- `timezone`, default `Asia/Jakarta`, stored as an IANA timezone.

`GET /households/:id/prefs` is available to every household member. Partial
`PATCH /households/:id/prefs` is admin-only. Financial date rules read the
stored timezone; they do not trust a browser-supplied timezone.

### Accounts

Add nullable `system_key` to `payment_sources`:

```text
DEFAULT_CASH | DEFAULT_BANK | null
```

The database enforces at most one of each non-null key per household. Household
creation/backfill guarantees at least one of each. Service-layer rules reject:

- archiving a source with a non-null system key;
- changing the kind of any account;
- creating a new EWALLET account;
- an `as_of` later than household-local today.

There remains no hard-delete route. Existing EWALLET accounts remain in list
and positions responses so household totals do not lose history.

### Categories

Add nullable stable semantic keys to `expense_types` and `income_types`. The
wire calls these resources categories even if the physical table names remain
unchanged during compatibility.

The semantic key, rather than a mutable display name or list position, drives
the preset icon. A custom category has a null key and receives the generic
custom-category icon. Income Categories receive stable ordering so chips do
not unexpectedly reorder alphabetically after a rename.

### Income and transfers

Make `income.type_id` nullable and enforce the matrix in both service code and
a database CHECK constraint:

| kind              | `type_id` | `from_source_id` | `to_source_id` |
| ----------------- | --------- | ---------------- | -------------- |
| `EXTERNAL_INCOME` | required  | null             | required       |
| `TRANSFER`        | null      | required         | required       |

The existing distinct-source constraint remains. Create and update validation
runs against the final merged row, not only the partial request body.

### Member names

Add `first_name` and `last_name` to users and membership invitations. During
the compatibility window, the existing `name` remains as a derived display
name and existing responses continue to include it.

New member/admin creation requires both new fields. Existing names are
backfilled by treating the final whitespace-delimited token as last name and
everything before it as first name. A legacy one-token name is retained and
uses the fallback compact-label rule until edited from My Account.

`PATCH /auth/me/name` accepts `first_name` and `last_name`, updates the display
name atomically and returns the updated profile. `GET /auth/me` and household
member resources add both fields without removing `name` yet.

## Account creation and reconciliation

### Creating an account

The frontend exposes two actions but may continue using one backend resource:

```text
Add Cash         -> POST /payment-sources with kind CASH
Add Bank Account -> POST /payment-sources with kind BANK
```

The form asks for name, opening balance and opening date. It does not contain a
Kind control. The backend accepts only CASH or BANK for new rows and rejects a
future opening date.

Keeping one endpoint avoids duplicating validation and is not an extra user
decision: the explicit CTA has already selected the domain kind.

### Reconciling an account

Add an intent-level operation:

```text
POST /payment-sources/:id/reconcile
{
  "target_balance": "8100000.00",
  "reason": "Matched bank statement"
}
```

The backend:

1. resolves household-local today;
2. locks the account for reconciliation;
3. obtains its authoritative current balance;
4. calculates `delta = target_balance - current_balance`;
5. appends one balance-adjustment row dated today;
6. writes the audit record in the same transaction;
7. returns the adjustment and resulting balance.

The frontend never calculates or sends the delta. The existing low-level
adjustment endpoint remains temporarily for compatibility but is not used by
the redesigned UI. No-op reconciliation is rejected or returned explicitly;
it never creates a zero adjustment.

## Positions and the visible total balance

The existing `/positions` calculation remains canonical. It already includes
opening balances, external income, transfers, expenses and balance adjustments,
with each account's own `as_of` lower bound.

Its response gains additive summary metadata:

```json
{
  "success": true,
  "data": [
    { "source_id": "...", "opening_balance": "0.00", "balance": "100000.00" }
  ],
  "meta": {
    "summary": {
      "total_balance": "8100000.00",
      "currency": "IDR",
      "as_of": "2026-10-26"
    }
  }
}
```

This is additive: current clients reading only `data` continue to work. Expense
and Income headers query the same current-date positions cache and render
`total_balance` as **Household balance today**. Income keeps its detailed
per-account position card; Expense only needs the shared total.

## API naming compatibility

Expose category terminology without a big-bang break:

- `/expense-categories` aliases `/expense-types`;
- `/income-categories` aliases `/income-types`.

Both names use the same services, authorization and response shape. The old
paths are marked deprecated in API documentation, then removed only after all
known clients migrate. Database table renaming is unnecessary for this product
change.

## Settings information architecture

### Household Settings

- Accounts
  - protected default Cash and Bank first;
  - additional accounts grouped by kind;
  - `Add Cash` and `Add Bank Account` actions;
  - reconcile, rename and archive where allowed.
- Members
- Expense Categories
- Income Categories
- Household accounting
  - currency;
  - month start day;
  - timezone may initially remain fixed/hidden at Asia/Jakarta.

Category collections use compact chips with icons, a clear archived state and
an adjacent custom-category creation action. A long repeated card stack is not
used for short catalogue items.

### My Account

- Change name;
- Change email;
- Preferences: theme and language.

Theme and language remain device-local in this phase. Moving them under My
Account is an information-architecture change, not a promise of cross-device
sync.

## Ledger UX changes

### Expense

- Becomes the post-signin landing page.
- Shows Household balance today above or alongside month metrics.
- Expense creation is immediately usable from defaults.
- Category icons replace member initials as the primary row icon.
- Category, account and member selectors use cached catalogue/member data.
- Date rail follows the same descending chronology as the visible ledger and
  derives progress from the same filtered dataset.
- Search uses normal focus styling; it does not expose the browser's raw inner
  focus rectangle.

### Income

- Removes Record Expense from the Income page.
- Shows the same Household balance today summary while keeping the detailed
  position breakdown.
- External income asks for Income Category and destination account.
- Transfer asks only for source, destination, amount, date, name and optional
  note; it does not show Income Category.
- Income Category icons follow the same semantic-key approach as Expense.

### Calendar

Expense, external income and transfer use distinct label, sign, icon/marker and
source/destination treatment. Colour is supplementary, never the only
distinction.

## Query and mutation policy

- Shared catalogues and prefs use one query key per household and are reused
  across forms; opening a modal must not unconditionally refetch them.
- A failed create/update does not invalidate ledger, positions or catalogue
  queries.
- A successful expense mutation invalidates the affected expense scopes and
  positions.
- A successful external-income or transfer mutation invalidates the affected
  income scopes and positions.
- A successful reconciliation invalidates the account's adjustments and
  positions.
- No mutation applies optimistic changes to financial totals.
- Side-effect chains are covered by tests that assert both required and
  forbidden follow-up requests.

## Migration and backfill

Rollout is expand → migrate → contract.

1. Add nullable fields and additive API fields/routes.
2. Backfill household prefs.
3. For each existing household, designate the earliest suitable live CASH and
   BANK source as its protected default; create a zero-balance source only when
   that kind does not exist. Preserve the existing display name and balance.
4. Adopt an existing case-insensitive category name into the matching semantic
   key; create only missing presets.
5. Backfill name fields while retaining legacy `name`.
6. Deploy BE compatibility behavior.
7. Migrate FE to the new fields and aliases.
8. After production verification, make new invariants non-null where safe and
   schedule removal of legacy paths/fields as a separate change.

Backfill is idempotent and tenant-scoped. It never picks an archived account as
a default when a live account of that kind exists, never changes a balance, and
never combines ledger histories automatically.

## Error behavior

Domain failures use explicit stable codes. At minimum the frontend must be able
to distinguish:

- protected account cannot be archived;
- account kind is immutable;
- future account date;
- invalid transfer shape;
- duplicate category/account name;
- no-op reconciliation;
- stale or missing account/category reference.

Validation failure leaves every relevant query cache unchanged. Forms keep the
member's input and bind field errors where applicable.

## Verification gates

### Backend

- household creation and default provisioning are atomic;
- concurrent household/default creation cannot duplicate system keys;
- migration/backfill is idempotent;
- protected accounts cannot be archived or retyped;
- additional Cash and Bank accounts remain allowed;
- new EWALLET creation is rejected while legacy rows remain readable;
- future `as_of` is rejected in household-local time;
- transfer/category CHECK constraints reject every invalid matrix state;
- reconciliation writes the exact delta and `/positions` includes it;
- positions summary equals the exact sum of complete position rows;
- first/last name and legacy display-name compatibility are covered;
- all tenant-crossing probes remain 404/isolated;
- full BE CI gate passes.

### Frontend

- first-use expense and income work with a freshly created household;
- Account creation exposes only the two direct actions and no Kind field;
- protected account controls are absent and server rejection is handled;
- transfer never asks for Income Category;
- Expense and Income show the same current household balance;
- last-name selectors disambiguate duplicates and legacy mononyms;
- failed creates cause no ledger/positions refetch;
- Settings hierarchy and chip catalogues work at phone and desktop widths;
- keyboard, focus, loading, empty and error states pass regression tests;
- full FE type-check, lint, unit and build gates pass.

## Delivery slices

1. **BE foundation:** prefs/timezone, semantic keys, name expansion and nullable
   transfer category.
2. **BE invariants and migration:** defaults, protection, backfill, validation,
   reconciliation and positions summary.
3. **FE contract cutover:** new response fields, category aliases, profile name
   fields and shared current-balance query.
4. **Settings redesign:** new information architecture, direct account actions,
   chip catalogues and My Account.
5. **Ledger redesign:** first-use forms, transfer flow, icons, balance summary,
   date rail and fetch behavior.
6. **Calendar and copy polish:** semantic transaction distinction and remaining
   wording consistency.
7. **Contract cleanup:** observe production, then deprecate legacy fields and
   routes in a separate release.

## Non-goals

- Rewriting the expense or income ledger.
- Replacing session authentication.
- Adding nickname in this release.
- Adding investments, budgets or savings.
- Deleting or silently converting existing EWALLET history.
- Synchronizing personal theme/language across devices.
- Removing legacy endpoints in the same release that introduces aliases.
