# BE Household Defaults and Catalogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every household immediately usable by provisioning protected default accounts, preset categories, stable category identities, and household accounting preferences.

**Architecture:** Expand the Prisma schema additively, expose household prefs and category aliases through existing guard conventions, then provision defaults through one reusable transaction helper used by household creation and backfill. Preserve existing ledger rows and API paths throughout rollout.

**Tech Stack:** NestJS 11, TypeScript 6 strict, Prisma 7, PostgreSQL 16, Jest 30, supertest.

**Spec:** `../specs/2026-10-26-household-ledger-foundation-design.md`

## Global Constraints

- Business invariants live in BE service code and database constraints, never only in FE.
- New households receive exactly one `DEFAULT_CASH` and one `DEFAULT_BANK` source with zero opening balance.
- Protected default accounts may be renamed and reconciled but not archived, deleted, or retyped.
- Preset categories may be renamed or archived; immutable semantic keys continue driving icons.
- Existing EWALLET rows remain readable; this plan neither deletes nor rewrites them.
- All new routes follow the existing global Auth → Tenant → Role guard convention and snake_case wire format.
- Backfill must be idempotent, tenant-scoped, and balance-preserving.

## Review Focus

- A household already containing several Cash or Bank sources adopts one deterministic live source without changing any balance.
- A case-insensitive preset-name collision adopts the existing category instead of creating a duplicate.
- Concurrent household creation cannot create duplicate system keys or catalogue order values.
- An archived source is not adopted when a live source of the same kind exists.
- A member can read prefs and categories but cannot mutate admin-owned settings.

---

### Task 1: Household accounting preferences

**Files:**

- Create: `prisma/migrations/<timestamp>_household_prefs_and_system_keys/migration.sql`
- Create: `src/household-prefs/household-prefs.module.ts`
- Create: `src/household-prefs/household-prefs.controller.ts`
- Create: `src/household-prefs/household-prefs.service.ts`
- Create: `src/household-prefs/dto/household-prefs-response.dto.ts`
- Create: `src/household-prefs/dto/update-household-prefs.dto.ts`
- Modify: `prisma/schema.prisma`
- Modify: `src/app.module.ts`
- Test: `src/household-prefs/household-prefs.service.spec.ts`
- Test: `test/household-prefs.e2e-spec.ts`

**Interfaces:**

- Produces: `HouseholdPrefsResource { currency; month_start_day; timezone }`, `HouseholdPrefsService.localDate(household_id, now): Promise<string>`.
- Consumes: existing `AuthUser`, tenant guard, `@IsAdmin()` and API envelope decorators.

- [ ] **Step 1: Write failing service and e2e tests** for defaults `IDR`, `1`, `Asia/Jakarta`; member GET; admin PATCH; member PATCH 403; invalid day/timezone 400; and cross-tenant header rejection.
- [ ] **Step 2: Run the focused tests and verify failure** with missing module/routes.
- [ ] **Step 3: Add schema fields and migration** with non-null defaults, `month_start_day` CHECK 1–28, and existing-household backfill.
- [ ] **Step 4: Implement the DTOs, service, controller and module** for `GET|PATCH /households/:id/prefs`; assert the path household equals the authenticated household before reading or writing.
- [ ] **Step 5: Run focused unit/e2e tests and verify pass.**
- [ ] **Step 6: Commit** as `feat(prefs): add household accounting preferences`.

### Task 2: Stable account and category identities

**Files:**

- Modify: `prisma/schema.prisma`
- Modify: `prisma/migrations/<timestamp>_household_prefs_and_system_keys/migration.sql`
- Modify: `src/payment-sources/payment-sources.service.ts`
- Modify: `src/payment-sources/dto/payment-source-response.dto.ts`
- Modify: `src/expense-types/expense-types.service.ts`
- Modify: `src/expense-types/dto/expense-type-response.dto.ts`
- Modify: `src/income-types/income-types.service.ts`
- Modify: `src/income-types/dto/income-type-response.dto.ts`
- Test: `test/payment-sources.e2e-spec.ts`
- Test: `test/expense-types.e2e-spec.ts`
- Test: `test/income-types.e2e-spec.ts`

**Interfaces:**

- Produces: nullable `system_key` on all three resources and stable `order` on Income Categories.
- Consumes: Task 1 migration and existing catalogue uniqueness/order rules.

- [ ] **Step 1: Add failing response and uniqueness tests** proving semantic keys appear, custom rows return null, and duplicate non-null keys per household are refused while null remains repeatable.
- [ ] **Step 2: Run focused e2e tests and verify failure.**
- [ ] **Step 3: Add Prisma enums/columns/constraints** for `DEFAULT_CASH`, `DEFAULT_BANK`, preset Expense keys and preset Income keys; add `income_types.order` with household-scoped uniqueness.
- [ ] **Step 4: Thread `system_key` and Income Category order through SELECT/resource/Swagger DTOs** without accepting either from ordinary create/update bodies.
- [ ] **Step 5: Run focused tests plus `npm run prisma:generate` and `npm run type-check`.**
- [ ] **Step 6: Commit** as `feat(catalogs): add stable preset identities`.

### Task 3: Atomic default provisioning

**Files:**

- Create: `src/household-defaults/household-defaults.ts`
- Create: `src/household-defaults/household-defaults.spec.ts`
- Modify: `src/console-households/console-households.service.ts`
- Modify: `src/console-households/console-households.service.spec.ts`
- Modify: `test/console-households.e2e-spec.ts`

**Interfaces:**

- Produces: `provisionHouseholdDefaults(tx, household_id, local_date): Promise<void>` and exported constant preset definitions.
- Consumes: system-key enums from Task 2 and the transaction already opened by `ConsoleHouseholdsService.create()`.

- [ ] **Step 1: Write failing helper tests** asserting exact account/category names, keys, kinds, zero balances, order, `as_of`, idempotency and rollback behavior.
- [ ] **Step 2: Run focused tests and verify failure** because the helper does not exist and household creation has no defaults.
- [ ] **Step 3: Implement preset constants and `provisionHouseholdDefaults`** using only the provided transaction client; serialize per-household catalogue writes before assigning order.
- [ ] **Step 4: Call the helper inside the existing household-creation transaction** after household creation and before the transaction returns.
- [ ] **Step 5: Add e2e assertions** that a freshly created household can list two accounts, seven Income Categories and twelve Expense Categories without Settings writes.
- [ ] **Step 6: Run unit/e2e tests and verify pass.**
- [ ] **Step 7: Commit** as `feat(households): provision financial defaults atomically`.

### Task 4: Existing-household backfill

**Files:**

- Create: `prisma/backfills/2026-10-26-household-defaults.sql`
- Create: `prisma/backfills/README.md`
- Test: `test/household-defaults-backfill.e2e-spec.ts`

**Interfaces:**

- Produces: an idempotent operational backfill run after the expand migration and before protection is relied on.
- Consumes: preset definitions and schema from Tasks 1–3.

- [ ] **Step 1: Write failing e2e fixtures** for empty households, multiple accounts, archived/live candidates, case-insensitive category collisions and rerunning the backfill.
- [ ] **Step 2: Run the backfill spec and verify failure** because the SQL artifact is absent.
- [ ] **Step 3: Implement the SQL backfill**: adopt the earliest live source per kind, fall back to earliest archived only when no live source exists, create a zero source only when none exists, and adopt/create categories case-insensitively.
- [ ] **Step 4: Document pre-flight, execution, verification and rollback queries** including counts per missing/duplicate system key.
- [ ] **Step 5: Run the backfill twice in e2e and verify unchanged balances, stable ids and no duplicate keys.**
- [ ] **Step 6: Commit** as `feat(migrations): backfill household defaults safely`.

### Task 5: Category route aliases and contract verification

**Files:**

- Modify: `src/expense-types/expense-types.controller.ts`
- Modify: `src/income-types/income-types.controller.ts`
- Modify: `test/expense-types.e2e-spec.ts`
- Modify: `test/income-types.e2e-spec.ts`
- Modify: `test/swagger.e2e-spec.ts`
- Modify: `notes/BE/BACKEND.md`

**Interfaces:**

- Produces: `/expense-categories` and `/income-categories` aliases backed by the same services; legacy routes remain operational and documented deprecated.
- Consumes: existing catalogue modules and Task 2 resource shapes.

- [ ] **Step 1: Add failing alias parity tests** covering GET, POST, PATCH, auth, tenancy and identical response resources across old/new paths.
- [ ] **Step 2: Run focused e2e/Swagger tests and verify failure.**
- [ ] **Step 3: Expose both controller paths without duplicating service logic** and mark only old Swagger operations deprecated.
- [ ] **Step 4: Update backend architecture documentation** with prefs, semantic keys, provisioning/backfill and route compatibility.
- [ ] **Step 5: Run the complete BE gate:** `npm run type-check && npm run lint:ci && npm test && npm run test:e2e && npm run build`.
- [ ] **Step 6: Commit** as `feat(api): add category terminology aliases`.
