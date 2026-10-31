# FE Settings and My Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize Settings around Household Settings and My Account, with direct Cash/Bank actions, protected defaults, reconciliation, compact category chips and structured profile editing.

**Architecture:** Cut API types/hooks over additively first, then replace the current four-scope settings composition with two ownership-based scopes. Reuse TanStack Query caches and preserve live financial history while progressively enabling new BE capabilities.

**Tech Stack:** React, TypeScript, Vite, TanStack Query, Tailwind CSS, Vitest, Testing Library, MSW, Paraglide.

**Spec:** `../specs/2026-10-26-household-ledger-foundation-design.md`

## Global Constraints

- Settings has only Household Settings and My Account top-level ownership scopes.
- Expense and Income Categories are subitems of Household Settings.
- Account creation exposes Add Cash and Add Bank Account; no Kind field exists.
- Default accounts cannot render archive/remove controls.
- Theme/language move to My Account but remain device-local.
- Currency/month start remain household-owned; timezone may remain hidden at the fixed default initially.
- Every new string is localized in English and Indonesian.

## Review Focus

- A non-admin can understand protected/read-only states without seeing dead controls.
- Long translated category names wrap without breaking chip hit targets.
- Duplicate last names remain distinguishable anywhere a member appears.
- A failed reconcile keeps target/reason values and does not update displayed balance.
- Legacy API responses lacking new optional fields degrade without a blank Settings page.

---

### Task 1: Additive Settings API contract

**Files:**

- Modify: `src/types/catalog.ts`
- Modify: `src/types/household.ts`
- Modify: `src/modules/settings/types/settings.ts`
- Modify: `src/modules/settings/api/accounts.ts`
- Modify: `src/modules/settings/api/adjustments.ts`
- Modify: `src/modules/settings/api/categories.ts`
- Rename/Modify: `src/modules/settings/api/incomeTypes.ts` to `incomeCategories.ts`
- Modify: `src/modules/settings/api/prefs.ts`
- Modify: `src/modules/auth/api/me.ts`
- Test: corresponding `*.test.tsx` files and MSW handlers/fixtures.

**Interfaces:**

- Produces: typed semantic keys, protection flags, structured names, live prefs, reconciliation mutation and category aliases.
- Consumes: BE contracts from the three BE plans.

- [ ] **Step 1: Add failing adapter/hook tests** for semantic keys, nullable transfer category compatibility, prefs timezone, positions/reconcile responses and structured names.
- [ ] **Step 2: Run focused Vitest files and verify failure.**
- [ ] **Step 3: Update wire/domain types and pure adapters** with explicit legacy fallbacks; do not cast new fields into existence.
- [ ] **Step 4: Change category paths to the new aliases and add the reconcile mutation** while keeping query keys stable per household.
- [ ] **Step 5: Turn off prefs MSW domain only after the live endpoint is available** and update route-classification tests.
- [ ] **Step 6: Run focused tests and commit** as `feat(settings): adopt household foundation contracts`.

### Task 2: Settings ownership navigation

**Files:**

- Modify: `src/modules/settings/pages/SettingsPage.tsx`
- Modify: `src/modules/settings/anchors.ts`
- Modify: `messages/en.json`
- Modify: `messages/id.json`
- Test: create/modify `src/modules/settings/pages/SettingsPage.test.tsx`

**Interfaces:**

- Produces: two top-level scopes `household` and `account`, URL-backed section anchors.
- Consumes: existing section components until later tasks replace their internals.

- [ ] **Step 1: Add failing navigation tests** for desktop rail, mobile chips, deep links, admin/member visibility and active-section reporting.
- [ ] **Step 2: Run the page test and verify failure.**
- [ ] **Step 3: Recompose sections**: Household contains Accounts, Members, Expense Categories, Income Categories, Household Accounting; My Account contains Change Name, Change Email, Preferences.
- [ ] **Step 4: Add EN/ID copy and verify every anchor remains linkable.**
- [ ] **Step 5: Run focused tests and commit** as `refactor(settings): organize by household and account ownership`.

### Task 3: Direct account actions and protected defaults

**Files:**

- Modify: `src/modules/settings/components/AccountSection.tsx`
- Modify: `src/modules/settings/components/BalanceAdjustmentPanel.tsx`
- Modify: `src/modules/settings/api/accounts.ts`
- Modify: `src/modules/settings/api/adjustments.ts`
- Test: `src/modules/settings/api/accounts.test.tsx`
- Test: `src/modules/settings/components/BalanceAdjustmentPanel.test.tsx`
- Create: `src/modules/settings/components/AccountSection.test.tsx`

**Interfaces:**

- Produces: `Add Cash`, `Add Bank Account`, protected account presentation and target-balance reconciliation UI.
- Consumes: Task 1 account/reconcile hooks.

- [ ] **Step 1: Add failing interaction tests** asserting exactly two creation CTAs, no Kind field, correct posted kind, past/today dates, protected controls, ordinary archive and failed reconcile cache stability.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Split the generic create form into CTA-seeded Cash/Bank variants** sharing one form body for name, opening balance and `as_of`.
- [ ] **Step 4: Replace direction/amount/date adjustment UI with target balance and reason** and render the returned resulting balance only after success.
- [ ] **Step 5: Align account amount typography with account name hierarchy and make protection explicit in copy.**
- [ ] **Step 6: Run focused tests and commit** as `feat(settings): simplify account creation and reconciliation`.

### Task 4: Category chips and semantic icons

**Files:**

- Create: `src/modules/settings/components/CategoryChipList.tsx`
- Create: `src/modules/settings/lib/categoryIcon.tsx`
- Modify: `src/modules/settings/components/CategorySection.tsx`
- Modify: `src/modules/settings/components/IncomeTypeSection.tsx`
- Test: existing category section tests plus new icon helper tests.

**Interfaces:**

- Produces: shared compact chip list and `categoryIcon(systemKey, domain)` mapping with generic custom fallback.
- Consumes: category semantic keys and aliases from Task 1.

- [ ] **Step 1: Add failing tests** for all preset keys, custom fallback, rename stability, archived state, keyboard actions and long labels.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Implement the semantic icon map and chip list** without using mutable names or order as identity.
- [ ] **Step 4: Migrate Expense and Income sections to the shared component** and change visible copy from Income Type to Income Category.
- [ ] **Step 5: Run focused tests and commit** as `feat(settings): present categories as semantic chips`.

### Task 5: My Account sections

**Files:**

- Modify: `src/modules/settings/components/ProfileSection.tsx`
- Create: `src/modules/settings/components/ChangeNameSection.tsx`
- Create: `src/modules/settings/components/ChangeEmailSection.tsx`
- Create: `src/modules/settings/components/PersonalPreferencesSection.tsx`
- Modify: `src/modules/settings/components/PreferencesSection.tsx`
- Modify: `src/modules/auth/api/me.ts`
- Test: create focused component tests for all three sections.

**Interfaces:**

- Produces: separate change-name, change-email and device-preference sections.
- Consumes: structured profile and PATCH-name contract from Task 1.

- [ ] **Step 1: Add failing tests** for prefilled first/last names, save/error state, email-flow navigation, theme/language persistence and absence of household controls.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Implement the three sections and invalidate/update only the authenticated profile cache after a successful name change.**
- [ ] **Step 4: Reduce Household Preferences to currency/month-start controls and capability-gate timezone if hidden.**
- [ ] **Step 5: Run focused tests and commit** as `feat(account): add structured profile and preferences`.

### Task 6: Settings responsive and regression gate

**Files:**

- Modify: Settings components touched above.
- Modify: `docs/ux-audit.md`

**Interfaces:**

- Produces: verified Settings experience at phone and desktop widths.
- Consumes: all prior FE Settings tasks.

- [ ] **Step 1: Add/complete accessibility tests** for focus order, labels, 44px mobile targets, disabled/read-only semantics and error announcements.
- [ ] **Step 2: Run `npm run type-check && npm run lint && npm test && npm run build`.**
- [ ] **Step 3: Manually verify fresh-admin, existing-admin and member flows at 375px and 1440px against the design spec.**
- [ ] **Step 4: Update the UX audit disposition/evidence links for completed Settings findings.**
- [ ] **Step 5: Commit** as `test(settings): close responsive and accessibility regressions`.
