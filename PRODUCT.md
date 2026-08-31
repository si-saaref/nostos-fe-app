# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary — the household admin, at a desk.** One or two people per household (usually the
creator plus a promoted invitee). They review the shared ledger, filter and correct entries,
answer "where did the money go this month", invite and remove members, and are the only role
permitted to edit or delete an expense. Most of their time is spent on a larger screen, in a
sit-down session, reading many rows at once.

**Secondary but real — the member, capturing on the go.** Two to four invited family members
per household. They log an expense right after paying, usually on a phone, often standing in
a shop and in a hurry. They can create and read; they cannot edit or delete. Responsiveness
is not a courtesy for this audience — capture on a phone is an expected path, and the app
also ships as a Capacitor shell to iOS and Android.

Household size in scope: 2–6 people, one household per person at a time.

**Not a user of this app:** the operator. Household creation, deletion and restoration are
Console actions in a separate product and repository. This app never offers them.

## Product Purpose

NOSTOS — Greek _νόστος_, "homecoming" — gives a family one trusted, shared record of what the
household spends. It replaces scattered spreadsheets, bank-statement archaeology and memory
with a single household ledger: every expense logged once, with who paid, what it was for,
how it was paid, and when.

Success is a household that stops arguing about who paid last time, because the answer is on
a screen both people can see. Concretely: an expense can be recorded in under a minute by any
member, the month's spending is legible without reconstruction, and no household ever sees
another household's data.

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

- **The capture moment.** A member pays for something — groceries, utilities, transport, a
  QRIS scan — and records it soon after on a phone. Six fields: what, how much, category,
  payment method, date paid, who paid.
- **The review session.** An admin opens the ledger on a laptop, filters by date range,
  category, payment method or person, searches, pages through results, and corrects what is
  wrong. Filters live in the URL so a filtered view is bookmarkable and shareable.
- **The household lifecycle.** An operator creates the household and its first admin in the
  Console. The admin invites members by name and email; each invite becomes a pending row
  immediately and is claimed by clicking an emailed link. Members can be removed; anyone can
  leave; a household can be scheduled for deletion by an operator, which members experience
  as lost access and the admin experiences as a read-only banner with a deadline.
- **Categories and payment methods are household-configured**, not a fixed taxonomy — one
  family's "Groceries / Utilities / Transport" is another's something else.
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
  `GET /api/expenses` returns a filter-scoped `totals: { sum, count, average }`
  alongside `items` and `pagination` (BE PRD §3.1); the repo's `Paginated<T>` type and
  MSW handler currently drop it. Because those totals are filter-scoped, any card built
  on them must state the period and filters it is counting, or it silently misreports.
  Nothing in the data model or any PRD supplies income, savings, an opening balance, or
  a payment-source balance, so **a cash-on-hand or "total current cash" figure is not
  computable in Phase 1 and must not be displayed**. Grouped aggregates (spend by
  category, by person) have no endpoint either and need backend work first.
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
Export (CSV/XLSX), bulk operations, restore UI, recurring expenses, expense splitting,
receipt attachments, analytics dashboards, income tracking, budgets and alerts,
multi-currency, inline editing, 2FA, international email domains.

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

## Evidence on Hand

- **Product and architecture documents** in the Obsidian vault, symlinked at `notes/` and not
  part of this repo: `notes/NOSTOS-Master-Document.md` (identity, locked stack, permission
  matrix, phases, decision log), `notes/FE-App/prd-auth-fe.md` v3.1,
  `notes/FE-App/prd-expenditure-fe.md` (17 acceptance criteria), `notes/MASTER_PRD_*`,
  `notes/BE/`. Never copy a vault document into the repo — link to it.
- **`docs/FRONTEND.md`** is the authoritative technical record for this repo and wins any
  disagreement with the vault about what this code actually does.
- **Mock fixtures only** for content: `src/mocks/fixtures/` — "The Smiths", Alex Smith,
  Groceries / Utilities / Transport, Cash / Debit Card, rupiah amounts. Useful as realistic
  shapes; not real household data.
- **No brand assets exist.** `public/favicon.svg` and `public/icons.svg` are unbranded
  template leftovers (a purple `#863bff` mark unrelated to NOSTOS), `src/assets/hero.png` is
  referenced by nothing, and `index.html` still titles the app "fe-app". There is no NOSTOS
  logo, wordmark, colour system, or type pairing. There is also no design language: the
  shipped UI is default-Tailwind scaffolding (`blue-600` on `gray-*`, system-ui type).
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
