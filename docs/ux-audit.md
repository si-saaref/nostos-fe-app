# Settings UX audit follow-up — 2026-10-27

This repository-local follow-up records the frontend disposition for the
Settings work in the household-ledger foundation. The source audit remains at
`notes/Planning/2026-10-26-household-ledger-foundation/ux-audit.md`; backend
acceptance criteria remain open where noted there.

| Finding                                              | Frontend disposition                                                                                                                                                                                                           | Evidence                                                                                                                                                                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1-01 — fragmented first-run setup                   | FE complete; BE default creation remains a release dependency. Settings consumes protected seeded Cash/Bank accounts and semantic categories, and optional accounts use direct `Add Cash` / `Add Bank Account` actions.        | [`AccountSection.tsx`](../src/modules/settings/components/AccountSection.tsx), [`AccountSection.test.tsx`](../src/modules/settings/components/AccountSection.test.tsx), [`categories.test.tsx`](../src/modules/settings/api/categories.test.tsx)             |
| P1-02 — transfer forced into income taxonomy         | FE contract complete. Transfer category is nullable, transfer forms neither require nor send a category, and invalid transfer/category combinations are rejected before submission.                                            | [`IncomeForm.test.tsx`](../src/modules/financial/components/IncomeForm.test.tsx), [`income.test.tsx`](../src/modules/financial/api/income.test.tsx)                                                                                                          |
| P1-04 — reconciliation may miss canonical position   | FE complete; BE position arithmetic remains a release dependency. Reconciliation submits a target balance and refreshes adjustment, account, and position data only after success.                                             | [`BalanceAdjustmentPanel.test.tsx`](../src/modules/settings/components/BalanceAdjustmentPanel.test.tsx), [`adjustments.test.tsx`](../src/modules/settings/api/adjustments.test.tsx)                                                                          |
| P1-05 — future account baseline                      | FE complete; BE validation remains required. The date control is capped at today and submit is guarded.                                                                                                                        | [`AccountSection.test.tsx`](../src/modules/settings/components/AccountSection.test.tsx)                                                                                                                                                                      |
| P2-03 — expected preferences 404s                    | FE integration complete against the shipped preference contract, including `timezone`. Household accounting remains distinct from device-only preferences.                                                                     | [`prefs.test.tsx`](../src/modules/settings/api/prefs.test.tsx), [`PreferencesSection.tsx`](../src/modules/settings/components/PreferencesSection.tsx), [`PersonalPreferencesSection.tsx`](../src/modules/settings/components/PersonalPreferencesSection.tsx) |
| P2-05 — settings grouped by feature instead of owner | Complete. The index has two scopes—Household Settings and My Account—with stable anchors, admin-gated shared settings, and separate name, email, theme, and language sections.                                                 | [`SettingsPage.test.tsx`](../src/modules/settings/pages/SettingsPage.test.tsx), [`SettingsAccessibility.test.tsx`](../src/modules/settings/pages/SettingsAccessibility.test.tsx)                                                                             |
| P3-03 — repeated full-width category plates          | Complete for categories and income categories. Both use compact semantic chips with stable icons, custom fallbacks, keyboard access, archived states, and focused editing. Account rows retain the richer financial hierarchy. | [`CategoryChipList.test.tsx`](../src/modules/settings/components/CategoryChipList.test.tsx), [`categoryIcon.test.tsx`](../src/modules/settings/lib/categoryIcon.test.tsx)                                                                                    |

## Verification

- Automated: type-check, lint, the full Vitest suite, and the production build.
- Browser: fresh admin, existing admin, and member role at exact 375 px and
  1440 px responsive widths on `localhost:6060`.
- Checked states: protected-account restrictions and reconciliation entry,
  direct account creation actions, member read-only messaging and disabled
  controls, category chips, My Account forms, labels, focus order, and mobile
  navigation/target sizing.

The browser-only mock switches and role/seed overrides used to reach these
states were reverted after verification and are not part of the product diff.

## Ledger implementation follow-up — 2026-10-28

Implemented on `feat/ledger-experience`: shared authoritative current balance on both ledgers, Expense landing, success-only financial cache updates/invalidation, default selections and catalogue reuse, category-free typed transfers, semantic category icons, deterministic compact member labels, composite search focus, and calendar −/+ /↔ cues with unchanged per-stream scaling.

Automated evidence: adapter metadata/legacy fallback, shared request/loading/error balance tests; failed/successful mutation request counts; first-use form submission; transfer type/form/legacy-row tests; preset/custom icons and member fallback tests; descending rail jump/keyboard focus; calendar marks/signs/routes tests. Full type-check, lint, unit/integration suite and production build run during implementation.

Browser verification remains constrained: local fixture server prepared on port 6061, but the available native Chrome surface repeatedly reported that the user changed the application and rejected input. No 375px/1440px screenshots or interaction verification were obtained. Responsive visual acceptance remains pending; automated checks are not visual release sign-off. Temporary offline fixture switches were restored.
