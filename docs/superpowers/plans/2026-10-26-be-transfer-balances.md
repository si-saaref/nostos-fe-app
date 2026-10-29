# BE Transfer and Balance Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make transfers category-free, make account rules enforceable, reconcile balances by target value, and return an authoritative household balance total.

**Architecture:** Strengthen the existing explicit income-kind model with conditional database constraints, preserve the append-only adjustment ledger, and refactor the positions SQL into a transaction-capable query primitive shared by positions and reconciliation.

**Tech Stack:** NestJS 11, TypeScript 6 strict, Prisma 7, PostgreSQL 16, Jest 30, supertest.

**Spec:** `../specs/2026-10-26-household-ledger-foundation-design.md`

## Global Constraints

- `EXTERNAL_INCOME` requires a category and has no origin source.
- `TRANSFER` requires an origin source and has no category.
- Source and destination must differ.
- Account kind is immutable; new writes accept CASH or BANK only.
- Account opening dates cannot exceed household-local today.
- Reconciliation accepts a target balance; only BE computes and stores the delta.
- Financial totals use Decimal/PostgreSQL NUMERIC and never floating-point arithmetic.

## Review Focus

- Partial income PATCH validates the final merged row and cannot leave kind/category/source inconsistent.
- A transfer remains neutral in household total even when both accounts are included.
- Concurrent reconciliations serialize and the second computes from the first result.
- Reconciliation of an archived/protected account remains allowed when the account still carries money.
- A date that is today in Asia/Jakarta but tomorrow in UTC is accepted correctly.

---

### Task 1: Conditional transfer-category schema

**Files:**

- Create: `prisma/migrations/<timestamp>_category_free_transfers/migration.sql`
- Modify: `prisma/schema.prisma`
- Modify: `src/income/dto/create-income.dto.ts`
- Modify: `src/income/dto/update-income.dto.ts`
- Modify: `src/income/dto/income-response.dto.ts`
- Modify: `src/income/income-serializer.ts`
- Test: `src/income/income-serializer.spec.ts`
- Test: `test/income.e2e-spec.ts`

**Interfaces:**

- Produces: `type_id: string | null` across Prisma, DTOs, resource and wire.
- Consumes: existing `IncomeKind` and distinct-source CHECK.

- [ ] **Step 1: Add failing create/update/e2e matrix tests** for all valid and invalid combinations of kind, `type_id` and `from_source_id`, including partial PATCH merged-state cases.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Make `income.type_id` nullable and add the database CHECK** encoding the exact two-row matrix while preserving the distinct-source constraint.
- [ ] **Step 4: Update DTO validation, serializer and Swagger types** so null is legal only where the service matrix allows it.
- [ ] **Step 5: Run `npm run prisma:generate`, focused tests and migration drift check.**
- [ ] **Step 6: Commit** as `feat(income): make transfers category-free`.

### Task 2: Income service final-state validation

**Files:**

- Modify: `src/income/income-refs.ts`
- Modify: `src/income/income-refs.spec.ts`
- Modify: `src/income/income.service.ts`
- Modify: `src/income/income-where.ts`
- Modify: `src/income/income-totals.ts`
- Test: `src/income/income-totals.spec.ts`
- Test: `test/income.e2e-spec.ts`

**Interfaces:**

- Produces: `assertIncomeShape(kind, type_id, from_source_id, to_source_id): void` used by create and merged update.
- Consumes: nullable type contract from Task 1.

- [ ] **Step 1: Write failing unit tests** for `assertIncomeShape` plus list/filter/totals behavior when transfer `type_id` is null.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Implement one shape validator and use it on create and locked merged update state.**
- [ ] **Step 4: Validate category references only when final kind is external income; never query a category for transfer.**
- [ ] **Step 5: Run unit and income e2e tests and verify pass.**
- [ ] **Step 6: Commit** as `refactor(income): enforce transaction shape centrally`.

### Task 3: Account write invariants

**Files:**

- Modify: `src/payment-sources/dto/create-payment-source.dto.ts`
- Modify: `src/payment-sources/dto/update-payment-source.dto.ts`
- Modify: `src/payment-sources/payment-sources.service.ts`
- Modify: `src/payment-sources/payment-sources.controller.ts`
- Test: `test/payment-sources.e2e-spec.ts`

**Interfaces:**

- Produces: immutable kind, CASH/BANK-only creation, household-local future-date rejection and protected-source archive rejection.
- Consumes: `HouseholdPrefsService.localDate()` and `system_key` from the defaults plan.

- [ ] **Step 1: Add failing e2e tests** for future/present/past `as_of`, EWALLET create rejection, absent Kind update field, protected archive rejection and ordinary account archive success.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Remove `kind` from update DTO and service data**, retain it on create as an API discriminator, and whitelist CASH/BANK in service validation.
- [ ] **Step 4: Add household-local `as_of` validation and protected archive guard** with explicit stable error codes.
- [ ] **Step 5: Run focused tests and verify pass.**
- [ ] **Step 6: Commit** as `feat(accounts): enforce immutable account rules`.

### Task 4: Transaction-capable position calculation

**Files:**

- Create: `src/positions/position-query.ts`
- Create: `src/positions/position-query.spec.ts`
- Modify: `src/positions/positions.service.ts`
- Modify: `test/positions.e2e-spec.ts`

**Interfaces:**

- Produces: `queryPositions(client, household_id, { from, as_of }): Promise<PositionResource[]>` accepting Prisma root or transaction client.
- Consumes: the existing tagged raw SQL exactly, including tenant and per-source `as_of` filters.

- [ ] **Step 1: Add failing parity tests** proving the extracted query returns the existing results for expenses, external income, transfer, adjustments, archived sources and cross-tenant fixtures.
- [ ] **Step 2: Run positions tests before extraction to capture passing baseline, then add extraction test and verify it fails.**
- [ ] **Step 3: Extract the tagged query without changing SQL semantics** and delegate `PositionsService.list()` to it.
- [ ] **Step 4: Run positions unit/e2e tests and compare exact Decimal strings.**
- [ ] **Step 5: Commit** as `refactor(positions): share transaction-capable balance query`.

### Task 5: Target-balance reconciliation

**Files:**

- Create: `src/balance-adjustments/dto/reconcile-balance.dto.ts`
- Create: `src/balance-adjustments/dto/reconcile-balance-response.dto.ts`
- Modify: `src/balance-adjustments/balance-adjustments.controller.ts`
- Modify: `src/balance-adjustments/balance-adjustments.service.ts`
- Test: `src/balance-adjustments/balance-adjustments.service.spec.ts`
- Test: `test/payment-sources.e2e-spec.ts`

**Interfaces:**

- Produces: `POST /payment-sources/:sourceId/reconcile` with `{ target_balance, reason }`; returns `{ adjustment, previous_balance, balance }`.
- Consumes: `queryPositions()` from Task 4 and household-local today from prefs.

- [ ] **Step 1: Add failing service/e2e tests** for increase, decrease, negative target, no-op, protected source, archived source, audit row and two serialized reconciliations.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Implement the DTO and response contract** using canonical money strings and a non-empty reason.
- [ ] **Step 4: Implement reconciliation in one transaction**: lock source, query current position, calculate Decimal delta, reject zero, append adjustment dated server-resolved today, audit, return resulting balance.
- [ ] **Step 5: Keep the existing dated adjustment route for compatibility** but mark it deprecated in Swagger.
- [ ] **Step 6: Run focused tests and verify pass.**
- [ ] **Step 7: Commit** as `feat(accounts): reconcile to an authoritative target balance`.

### Task 6: Authoritative positions summary

**Files:**

- Modify: `src/positions/positions.service.ts`
- Modify: `src/positions/positions.controller.ts`
- Modify: `src/positions/dto/position-response.dto.ts`
- Modify: `src/common/types/api-response.ts`
- Modify: `test/positions.e2e-spec.ts`
- Modify: `test/swagger.e2e-spec.ts`
- Modify: `notes/BE/BACKEND.md`

**Interfaces:**

- Produces: additive `meta.summary { total_balance, currency, as_of }` while preserving the position array in `data`.
- Consumes: prefs currency and complete rows from `queryPositions()`.

- [ ] **Step 1: Add failing envelope tests** asserting exact total strings, transfer neutrality, negative balances, archived-source inclusion and empty-household zero.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Add a non-paginated result/meta type and return the backend-computed Decimal sum** without changing `data`.
- [ ] **Step 4: Update Swagger and backend documentation.**
- [ ] **Step 5: Run the complete BE gate:** `npm run type-check && npm run lint:ci && npm test && npm run test:e2e && npm run build`.
- [ ] **Step 6: Commit** as `feat(positions): return household balance summary`.
