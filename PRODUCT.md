# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary — the household admin, at a desk.** One or two people per household (usually the
creator plus a promoted invitee). They review the shared ledger, filter and correct entries,
answer "where did the money go this month" and "how much do we actually have", invite and
remove members, and are the only role permitted to edit or delete an expense or an income
entry. Most of their time is spent on a larger screen, in a
sit-down session, reading many rows at once.

**Secondary but real — the member, capturing on the go.** Two to four invited family members
per household. They log an expense right after paying, usually on a phone, often standing in
a shop and in a hurry — and they log an inflow the same way: a salary that landed, a cash
withdrawal at an ATM, a gift. They can create and read; they cannot edit or delete. Responsiveness
is not a courtesy for this audience — capture on a phone is an expected path, and the app
also ships as a Capacitor shell to iOS and Android.

Household size in scope: 2–6 people, one household per person at a time.

**Not a user of this app:** the operator. Household creation, deletion and restoration are
Console actions in a separate product and repository. This app never offers them.

## Product Purpose

NOSTOS — Greek _νόστος_, "homecoming" — gives a family one trusted, shared record of what the
household spends and what it takes in. It replaces scattered spreadsheets, bank-statement
archaeology and memory with a single household ledger: every expense logged once, with who
paid, what it was for, how it was paid, and when; every inflow logged once, with where it
came from, where it landed, and what kind of money it was.

Together those two halves answer the question neither could answer alone — **how much does
this household actually hold, and in which payment source** — because a balance is an opening
balance plus income minus expenses, per source.

Success is a household that stops arguing about who paid last time, because the answer is on
a screen both people can see. Concretely: an expense or an inflow can be recorded in under a
minute by any member, the month's money is legible without reconstruction, and no household
ever sees another household's data.

## Positioning

Not a budgeting app and not a personal finance tracker with a sharing feature bolted on.
NOSTOS is **household-first**: the household — not the individual — is the unit of data, of
identity, and of trust. Three commitments a neighboring product could not truthfully copy
without rebuilding its foundations:

1. **Shared visibility with asymmetric control.** Everyone sees everything; only admins can
   change or remove history. Transparency without the risk that a record quietly changes.
2. **Attribution that survives the person.** A member who leaves is anonymized in place,
   never hard-deleted, because the expenses they recorded belong to the household's history.
3. **Tenant isolation as a product promise, not an implementation detail.** `household_id`
   is on every query, every mutation, every response, enforced at five layers.

The brand frame is the Odyssey: an epic journey ending in return. Finances brought back home
— organized, transparent, trusted.

## Operating Context

- **The capture moment, outbound.** A member pays for something — groceries, utilities,
  transport, a QRIS scan — and records it soon after on a phone. Six fields: what, how much,
  category, payment method, date paid, who paid.
- **The capture moment, inbound.** A salary lands, a bonus arrives, a relative gives cash —
  or nothing arrives at all and money simply moves, from a bank to a pocket at an ATM or from
  a bank to an e-wallet on a top-up. Both are one income entry: from source (empty when the
  money came from outside the household), to source, amount, type, name, date. **Transfers
  are the common case, not the exception** — most income entries in a real month move money
  the household already had, and they must never read as earnings.
- **The review session.** An admin opens the ledger on a laptop, filters by date range,
  category, payment method or person, searches, pages through results, and corrects what is
  wrong. Filters live in the URL so a filtered view is bookmarkable and shareable.
- **The household lifecycle.** An operator creates the household and its first admin in the
  Console. The admin invites members by name and email; each invite becomes a pending row
  immediately and is claimed by clicking an emailed link. Members can be removed; anyone can
  leave; a household can be scheduled for deletion by an operator, which members experience
  as lost access and the admin experiences as a read-only banner with a deadline.
- **The position question.** "Do we have enough for this?" is answered per payment source,
  and a household commonly runs several sources of the same kind — BSI, BNI and BCA are three
  banks; ShopeePay and GoPay are two e-wallets. Any surface stating position groups by kind
  and subtotals it, and survives eight sources without redesign.
- **Balances carry across months and flows do not.** A source holding Rp 250.000 on
  30 September holds Rp 250.000 on 1 October. Flow figures are month-scoped and reset;
  position figures are cumulative to a date. Two clocks, and any surface showing both stamps
  each with the clock it runs on.
- **Categories, payment sources and income types are household-configured**, not a fixed
  taxonomy — one family's "Groceries / Utilities / Transport" is another's something else,
  and one family's income types are "salary / bonus / tarik tunai" while another's are not.
- **Money is Indonesian Rupiah** by default, formatted with an `id-ID` locale, whole-rupiah
  display, two decimals accepted on input.

## Capabilities and Constraints

**Shipped and load-bearing today**

- Session-backed protected shell; a dashboard; an expenses page with server-driven list,
  URL-backed filters and pagination, and an inline create form.
- Every request carries `X-Household-ID`; the household id must be in axios module scope
  before any descendant effect fires (a deep link to `/financial/expenses` otherwise sends
  an unscoped request).
- MSW mock backend for local development.

**Specified, not yet built** — the near-term surface backlog

- Expense edit and delete (admin only), each behind a confirmation.
- **Income** (`notes/MASTER_PRD_INCOME.md`, shaped in `docs/SURFACE-INCOME.md`): a
  month-scoped income page — one stated position card grouped by source kind, one
  day-to-day statement of all flows beneath it — plus record/edit/delete and a
  Settings → Income Types section whose presets appear whenever the household has no
  types yet.
- Mobile card view of the ledger; the desktop table is the only list rendering today.
- A 3–4 card summary strip at the top of the expenses page — confirmed in scope
  (2026-08-27). Bounded by the aggregate-availability constraint below.
- Members list with six derived states (joined, pending, no access, left, removed, former
  member), invite form (name + email, both required), resend, remove.
- Account settings: change email, leave household.
- Household-deletion states: an unauthenticated modal that shows a deadline and nothing else,
  and a read-only admin banner with no cancel action.
- Empty, loading, error and permission-denied states across the ledger.

**Hard constraints future work must preserve**

- **Permission matrix.** Create: member ✅ admin ✅. Read: member ✅ admin ✅. Update, delete,
  export: admin only, hidden in the UI and enforced with 403 by the API.
- **Soft delete only**, with a 30-day recovery window. Nothing is destroyed on request.
- **Audit trail** on every mutation; audit records are never deleted.
- **One household per person at a time**; email ownership is global and a person who moves
  households gets a new row, never a moved one.
- **Passwordless signin by magic link** is the auth direction (auth PRD v3.1). The shipped
  email + password form is legacy to be migrated; passwords are a Phase 2 consideration.
  There is no in-app household deletion, no cancel-deletion control, and no separate
  session-status endpoint — any 401 from any query is the revocation signal.
- **ASCII-only email validation** in Phase 1.
- **Aggregate data availability is narrow, and it bounds every summary surface.**
  `GET /api/expenses` and `GET .../income` each return a filter-scoped
  `totals: { sum, count, average }` alongside `items` and `pagination` (BE PRD §3.1).
  Because those totals are filter-scoped, any figure built on them must state the period
  and filters it is counting, or it silently misreports. Grouped aggregates — spend by
  category, spend by person, income by type — have no endpoint and need backend work first.
  Anything derived client-side from the rows on hand is honest **only while the page holds
  every row in the filtered set**, so it is guarded against `pagination.total` and shows
  nothing rather than a partial sum.
- **A per-source balance is now in scope, and it is a backend dependency.**
  `payment_sources.opening_balance` + `as_of` plus the income ledger make
  `opening ± income ∓ expense` derivable per source (income PRD §5), which retires the
  earlier rule that no cash figure was computable. It is **not** computable in the browser:
  it needs every income and expense the household has ever recorded, across all months, so
  a wide fetch would be silently wrong the moment history outgrows one page. It requires
  `GET /api/v1/households/:id/positions?as_of=&from=&to=` returning per-source
  `opening_balance` and `balance`. Until that endpoint is live, every position surface
  renders a stated degraded band — no number, a plain sentence — and **never a guessed
  balance**. Zero and negative balances are legal and are designed states, not bugs.
- **Net inflow and real income are the same figure.** `totals.sum` on the income list is
  `sum(to) − sum(from)`, so a transfer cancels itself and only money from outside the
  household survives. Never present the two as separate figures, and never present either
  as a balance: a flow total and a carried-forward position are different quantities, and
  an empty month has a real position and a zero inflow.
- **Full internationalization is required.** English and Bahasa Indonesia are both real
  targets: no hardcoded strings, and every layout must survive longer translations without
  truncating or reflowing into illegibility. Currency and dates stay locale-aware.
- **No global state store.** TanStack Query owns server data, URL params own filters, Context
  owns session, `useState` owns local UI. No Redux, no Zustand.
- **Client-only SPA.** React 19, TypeScript strict, Vite, React Router 7, Tailwind CSS v4,
  react-hook-form, axios. No component library is installed — every element is a plain
  Tailwind-styled DOM node, despite the master document naming Radix/Headless UI.
- **Capacitor shell** to iOS and Android from the same web build (`webDir: dist`). One
  responsive design language, not two per-OS ones; native affordances (date picker, safe
  areas, touch targets) are used where they are cheap and expected.

**Explicitly out of scope for Phase 1**
Export (CSV/XLSX), bulk operations, restore UI, recurring expenses and recurring income,
expense splitting and income splitting, receipt attachments, analytics dashboards and income
trends, budgets and alerts, multi-currency, inline editing, 2FA, international email domains.
On income specifically: **search, filter and sort are deferred** — the income page is scoped
by month and nothing else — and there is no income card on the dashboard yet.

**Explicitly undecided** — do not resolve these silently in design work

- Whether create uses a modal (as the expenditure PRD specifies) or the inline expanding
  panel currently shipped.

## Brand Commitments

- **Name:** NOSTOS. Greek νόστος, "homecoming", from Homer's _Odyssey_. Renamed from AMEEN;
  the name is locked.
- **Tagline in use:** "Nostos: Bring Your Family Home." Recorded alternates: "The homecoming
  of organized family finances", "Where families gather financially", "Home, brought
  together".
- **Brand story (locked):** like Odysseus's return home after an epic journey, NOSTOS brings
  a family's finances back to one place — organized, transparent, trusted.
- **Promise, in the household's words:** one trusted place; shared visibility with
  role-based control; an audit trail on everything.
- Two sibling products share the vault and its terminology: the Operator Console
  (`fe-console-app-react/`) and the NestJS backend (`be-app/`). Terminology must stay
  consistent with them.
- **Pinned visual constraint (2026-08-27).** The user pinned a soft-UI /
  neumorphic-adjacent elevation language: tinted ground, near-white cards lifting on
  wide low-contrast shadows, generous radii, and inset (concave) treatment reserved for
  input wells. Scoped on acceptance to **soft chrome, crisp data** — containers are
  soft, while tabular rows, status badges, permission-dependent controls and destructive
  actions use real contrast, hairlines and solid fills, so WCAG 2.1 AA and the 1.4.11
  non-text 3:1 minimum both hold.
- **Terminology that is product truth, not synonym-swappable:** household (never "family
  account" in UI chrome), member, admin, operator, expense, expense type / category,
  payment source / payment method, paid by, invite, pending, no access, left, removed,
  former member, soft delete, audit trail, deletion deadline.
- **Income terminology, equally load-bearing:** income entry (never "transaction"), income
  type, from source and to source, external inflow (a `from source` of nothing — salary,
  bonus, gift), transfer (both sources set — withdrawal, deposit, top-up), position (what a
  source holds, cumulative to a date; never "cash on hand"), opening balance and its `as of`
  date, net inflow.

## Evidence on Hand

- **Product and architecture documents** in the Obsidian vault, symlinked at `notes/` and not
  part of this repo: `notes/NOSTOS-Master-Document.md` (identity, locked stack, permission
  matrix, phases, decision log), `notes/FE-App/prd-auth-fe.md` v3.1,
  `notes/FE-App/prd-expenditure-fe.md` (17 acceptance criteria),
  `notes/MASTER_PRD_INCOME.md` v1.0 (income, 4 user stories), `notes/MASTER_PRD_*`,
  `notes/BE/`. Never copy a vault document into the repo — link to it.
- **`docs/SURFACE-INCOME.md`** is the confirmed design brief for the income surface: its
  structure, signing rule, states and the backend contract it waits on.
- **`docs/API-CONTRACT-INCOME.md`** is the derived inventory of what the API already serves
  and what income still needs — 16 member-facing endpoints exist, income needs 8 more that
  do not. Derived from `notes/Postman/nostos-api.postman_collection.json` and the live
  probes in `notes/BE/CUTOVER-2026-09-07.md`, never from memory.
- **`docs/FRONTEND.md`** is the authoritative technical record for this repo and wins any
  disagreement with the vault about what this code actually does.
- **Mock fixtures only** for content: `src/mocks/fixtures/` — "The Smiths", Alex Smith,
  Groceries / Utilities / Transport, Cash / Debit Card, rupiah amounts. Useful as realistic
  shapes; not real household data.
- **A design language now exists in code and is authoritative.** `src/styles/globals.css`
  holds the theme contract — three themes (`mawar`, `kobalt`, `tegel`) over one set of custom
  properties, the four-plus `--rim-*` category/source channel, and the `plate-shadow` /
  `lift-shadow` / `well-shadow` / `strip-shadow` elevation scale. Type is Archivo with
  Archivo Narrow for display. No component may name a colour; adding a theme is a two-file
  change (`globals.css` + `src/theme/themes.ts`). `src/theme/rims.ts` derives a rim from a
  row's stable `order`, never from array position.
- **Brand assets are still missing.** `public/favicon.svg` and `public/icons.svg` are
  unbranded template leftovers (a purple `#863bff` mark unrelated to NOSTOS),
  `src/assets/hero.png` is referenced by nothing, and `index.html` still titles the app
  "fe-app". There is no NOSTOS logo or wordmark.
- **No usage data, customers, testimonials, press, pricing, benchmarks or launch metrics
  exist.** The success metrics in the master document are targets, not results. Future work
  must not present any of them as achieved, and must not invent households, quotes, or
  numbers.

## Product Principles

1. **The household is the unit.** Every screen, query and permission answers "which
   household?" before it answers anything else. Isolation is a promise to the family, not a
   backend concern.
2. **Everyone sees; admins change.** Design for shared visibility with asymmetric control —
   never hide the ledger, never let a member's view imply powers they don't have.
3. **Capture must be faster than remembering.** If logging an expense takes longer than a
   minute or more attention than a shop queue allows, the record stops being complete and
   the product's value collapses.
4. **History is never destroyed.** Soft delete, audit trail, anonymize-in-place. A person can
   leave; what they recorded stays with the household.
5. **State the state.** Deletion deadlines, pending invites, revoked access and lost sessions
   are ordinary parts of this product. Name them plainly, with the recovery path, and never
   stage an action that cannot succeed.

## Accessibility & Inclusion

- **WCAG 2.1 AA is the required standard** (both FE PRDs). The shipped app does not meet it:
  no focus management anywhere, no skip link, and colour contrast has never been audited
  against 4.5:1.
- Specific obligations already written into the specs: modals use `role="dialog"` /
  `alertdialog` with `aria-modal`, a focus trap, and focus restored to the trigger on close;
  banners use `role="alert"` with `aria-live="polite"`; status badges carry an `aria-label`
  spelling the state out and are never glyph-only; every destructive confirmation is
  reachable and dismissible by keyboard alone; touch targets are finger-sized on mobile.
- Two languages (English, Bahasa Indonesia) with no hardcoded strings, per Capabilities.
