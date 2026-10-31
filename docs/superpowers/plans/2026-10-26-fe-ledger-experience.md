# FE Ledger Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Expense the immediate first-use workflow, expose the authoritative household balance on both ledgers, simplify transfers, clarify transaction semantics and eliminate incorrect follow-up fetches.

**Architecture:** Adopt the additive BE contracts in pure adapters first, then share one current-position query across headers while preserving Income's detail card. Refactor mutation invalidation and forms before visual polish so the UI cannot display financially false optimistic state.

**Tech Stack:** React, TypeScript, Vite, TanStack Query, Tailwind CSS, Vitest, Testing Library, MSW, Paraglide.

**Spec:** `../specs/2026-10-26-household-ledger-foundation-design.md`

## Global Constraints

- Expense is the post-signin landing route.
- Expense and Income show the same BE-provided current household balance.
- Transfer never shows or submits an Income Category.
- Failed financial mutations do not invalidate ledger, positions or catalogue queries.
- Category semantic keys, not member initials, drive ledger row icons.
- Member compact labels use last name with deterministic duplicate/legacy fallback.
- Calendar distinguishes expense, external income and transfer without relying on colour alone.

## Review Focus

- A fresh household records its first expense/income before any Settings visit.
- A failed create leaves rows, totals and request counts unchanged while preserving form input.
- Slow positions and fast ledger responses never flash a false zero balance.
- Duplicate last names remain distinguishable at both phone and desktop widths.
- An archived source/category on an old row still renders meaningful history.

---

### Task 1: Current-balance contract and shared query

**Files:**

- Modify: `src/types/income.ts`
- Modify: `src/modules/financial/api/positions.ts`
- Modify: `src/modules/financial/api/positions.test.tsx`
- Create: `src/modules/financial/components/HouseholdBalance.tsx`
- Create: `src/modules/financial/components/HouseholdBalance.test.tsx`

**Interfaces:**

- Produces: positions result carrying `summary.totalBalance`, `currency`, `asOf`; reusable Household Balance loading/error/value component.
- Consumes: additive `/positions` meta summary.

- [ ] **Step 1: Add failing adapter/query tests** for exact money strings, additive meta, missing-meta legacy fallback and one cache entry shared by two consumers.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Update the positions adapter** to trust BE summary and keep row-derived totals only as an explicitly temporary legacy fallback.
- [ ] **Step 4: Implement the shared balance component** with `—` loading, unavailable state and no false zero.
- [ ] **Step 5: Run focused tests and commit** as `feat(positions): expose shared household balance`.

### Task 2: Mutation invalidation policy

**Files:**

- Modify: `src/modules/financial/api/expenses.ts`
- Modify: `src/modules/financial/api/income.ts`
- Modify: `src/modules/financial/api/createEntries.test.ts`
- Modify: related expense/income API tests.

**Interfaces:**

- Produces: success-only invalidation helpers scoped by household and financial domain.
- Consumes: existing TanStack Query entity keys.

- [ ] **Step 1: Add failing request-count tests** proving failed expense/income create performs no GET follow-up, while successful expense/income/transfer invalidates exactly the affected ledger and positions.
- [ ] **Step 2: Run focused tests and verify current unwanted refetches.**
- [ ] **Step 3: Centralize success-only invalidation** and remove modal-open forced refetches when valid cached catalogues exist.
- [ ] **Step 4: Run focused tests and commit** as `fix(financial): invalidate queries only after committed writes`.

### Task 3: First-use Expense and Income forms

**Files:**

- Modify: `src/modules/financial/components/ExpenseForm.tsx`
- Modify: `src/modules/financial/components/ExpenseForm.test.tsx`
- Modify: `src/modules/financial/components/IncomeForm.tsx`
- Modify: `src/modules/financial/components/IncomeForm.test.tsx`
- Modify: catalogue/account hooks consumed by the forms.

**Interfaces:**

- Produces: forms immediately populated from household defaults and capability-specific empty/error states.
- Consumes: cached default categories/accounts and structured member labels.

- [ ] **Step 1: Add failing fresh-household tests** proving first expense/external income can submit without Settings and modal opening does not force `/prefs` or duplicate catalogue requests.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Select sensible live defaults only when the member has not made a choice** and preserve explicit input across validation errors.
- [ ] **Step 4: Replace setup-blocking copy with retry/error states reserved for genuinely missing or failed default provisioning.**
- [ ] **Step 5: Run focused tests and commit** as `feat(financial): enable immediate first-use recording`.

### Task 4: Category-free transfer flow

**Files:**

- Modify: `src/types/income.ts`
- Modify: `src/modules/financial/api/income.ts`
- Modify: `src/modules/financial/components/IncomeForm.tsx`
- Modify: `src/modules/financial/components/IncomeForm.test.tsx`
- Modify: `src/modules/financial/components/IncomePlate.tsx`
- Modify: `src/modules/financial/components/IncomePlate.test.tsx`

**Interfaces:**

- Produces: discriminated `ExternalIncomeInput` and `TransferInput`; transfer wire payload always sends `type_id: null`.
- Consumes: BE conditional income contract.

- [ ] **Step 1: Add failing type/interaction tests** proving transfer has no category control/payload, requires distinct source/destination, and renders unsigned with route pills.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Introduce discriminated form state and payload builders** so impossible mixed shapes are unrepresentable in TypeScript.
- [ ] **Step 4: Keep external-income category behavior unchanged and render legacy categorized transfers defensively.**
- [ ] **Step 5: Run focused tests and commit** as `feat(income): simplify transfers around source and destination`.

### Task 5: Ledger headers and navigation hierarchy

**Files:**

- Modify: `src/modules/financial/pages/ExpensesPage.tsx`
- Modify: `src/modules/financial/pages/IncomePage.tsx`
- Modify: `src/modules/financial/components/CountStrip.tsx`
- Modify: `src/modules/financial/components/InflowStrip.tsx`
- Modify: `src/routes/index.tsx`
- Modify: auth redirect helpers/tests in `src/modules/auth/`.

**Interfaces:**

- Produces: Expense landing route, shared Household Balance on both pages, Income-only detailed positions and no Record Expense CTA on Income.
- Consumes: Task 1 balance component.

- [ ] **Step 1: Add failing page/route tests** for post-signin `/expenses`, balance placement/states, absent Income expense CTA and retained Income position details.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Recompose the two headers** so current balance is visually separate from month metrics but present above the ledger action area.
- [ ] **Step 4: Update signin/claim/invite success destinations and legacy redirects to Expense.**
- [ ] **Step 5: Run focused tests and commit** as `feat(financial): lead with expenses and current balance`.

### Task 6: Semantic icons and member labels

**Files:**

- Modify: `src/modules/financial/components/ExpensePlate.tsx`
- Modify: `src/modules/financial/components/IncomePlate.tsx`
- Create: `src/modules/financial/lib/memberLabel.ts`
- Create: `src/modules/financial/lib/memberLabel.test.ts`
- Reuse: `src/modules/settings/lib/categoryIcon.tsx`

**Interfaces:**

- Produces: category-led row icon and `compactMemberLabels(members): Map<id, string>` using last name with deterministic fallback.
- Consumes: semantic category keys and structured member names.

- [ ] **Step 1: Add failing tests** for every preset/custom icon, duplicate last names, legacy mononyms, missing former-member fields and narrow-row truncation.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Implement label disambiguation** using last name, then last plus first initial/full name only where duplicates require it.
- [ ] **Step 4: Replace initial avatars on ledger rows with category icons** while retaining member identity in metadata/tooltips.
- [ ] **Step 5: Run focused tests and commit** as `feat(ledger): clarify categories and family member labels`.

### Task 7: Expense search and descending date rail

**Files:**

- Modify: `src/modules/financial/components/ExpenseFilter.tsx`
- Modify: `src/modules/financial/components/MonthRail.tsx`
- Modify: `src/modules/financial/components/ExpenseTape.tsx`
- Modify: `src/modules/financial/hooks/useExpenseFilters.ts`
- Create/Modify: focused component/hook tests.

**Interfaces:**

- Produces: one shared descending date model for rail, tape and cumulative progress; polished accessible search focus.
- Consumes: filtered Expense result ordering.

- [ ] **Step 1: Add failing tests** for descending dates, rail/tape scroll synchronization, total progression, search keyboard focus and no nested/raw focus rectangle.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Derive rail marks and totals from the same descending grouped dataset used by the tape.**
- [ ] **Step 4: Normalize search input focus styling with a single visible `:focus-within` treatment.**
- [ ] **Step 5: Run focused tests and commit** as `fix(expenses): align search and date navigation`.

### Task 8: Calendar semantic distinction and copy pass

**Files:**

- Modify: `src/modules/financial/lib/calendarMonth.ts`
- Modify: `src/modules/financial/components/MonthGrid.tsx`
- Modify: `src/modules/financial/components/DaySheet.tsx`
- Modify: their existing tests.
- Modify: `messages/en.json`
- Modify: `messages/id.json`
- Modify: `docs/ux-audit.md`

**Interfaces:**

- Produces: explicitly labelled Expense, Income and Transfer calendar marks/rows plus consistent category/income/expense terminology.
- Consumes: transaction kind and category semantic data from previous tasks.

- [ ] **Step 1: Add failing visual-semantic tests** proving all three transaction kinds differ by label, sign, marker position/icon and source/destination text without colour assertions.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Update calendar marks, accessible names, legend and day rows** while retaining per-stream scale behavior.
- [ ] **Step 4: Audit EN/ID copy** for Expense(s), Income, Income Category and unrelated/generated phrasing.
- [ ] **Step 5: Run `npm run type-check && npm run lint && npm test && npm run build`.**
- [ ] **Step 6: Manually verify 375px and 1440px Expense, Income and Calendar flows and update UX audit evidence/disposition.**
- [ ] **Step 7: Commit** as `feat(financial): complete transaction semantics and copy polish`.
