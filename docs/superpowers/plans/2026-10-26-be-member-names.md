# BE Member Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first/last-name identity and self-service name changes while preserving legacy `name` compatibility.

**Architecture:** Expand users and invitations with nullable compatibility fields, backfill deterministically, dual-write all creation paths, then expose additive response fields and a guarded self-service PATCH. Legacy `name` remains until every client migrates.

**Tech Stack:** NestJS 11, TypeScript 6 strict, Prisma 7, PostgreSQL 16, Jest 30, supertest.

**Spec:** `../specs/2026-10-26-household-ledger-foundation-design.md`

## Global Constraints

- New members/admins require first and last name.
- Compact FE labels use last name, but BE returns complete identity fields.
- Existing one-token names remain valid during migration and are never fabricated destructively.
- `name` remains an additive compatibility display field in this release.
- Changing a name must not rotate sessions, memberships, audit identity or ledger ownership.

## Review Focus

- Apostrophes, hyphens, multiple spaces and non-ASCII letters survive normalization correctly.
- Legacy mononyms remain readable and can be repaired through My Account.
- Invitation acceptance preserves the first/last values entered by the admin.
- Changing a name on one device appears through `GET /auth/me` on another without reauthentication.
- Former/tombstoned member attribution remains stable after schema expansion.

---

### Task 1: Expand and backfill name fields

**Files:**

- Create: `prisma/migrations/<timestamp>_member_first_last_names/migration.sql`
- Modify: `prisma/schema.prisma`
- Test: `test/member-names-migration.e2e-spec.ts`

**Interfaces:**

- Produces: nullable compatibility columns `first_name`, `last_name` on `users` and `membership_invitations`.
- Consumes: existing `name` values as the migration source.

- [ ] **Step 1: Add failing migration fixtures** for two-token, multi-token, whitespace-heavy, apostrophe/hyphen and mononym names.
- [ ] **Step 2: Run the migration spec and verify failure.**
- [ ] **Step 3: Add columns and deterministic backfill SQL** using the final token as last name and the preceding text as first name; leave legacy mononym `last_name` null rather than inventing a value.
- [ ] **Step 4: Run migration twice through reset/deploy fixtures and verify original `name` remains unchanged.**
- [ ] **Step 5: Commit** as `feat(identity): expand member names`.

### Task 2: Dual-write creation and invitation paths

**Files:**

- Modify: `src/console-households/dto/create-household.dto.ts`
- Modify: `src/console-households/console-households.service.ts`
- Modify: `src/console-households/console-households.service.spec.ts`
- Modify: `src/household-members/dto/invite-member.dto.ts`
- Modify: `src/household-members/household-members.service.ts`
- Modify: `src/household-members/household-members.service.spec.ts`
- Modify: `src/app-auth/app-redemptions.service.ts`
- Test: `test/console-households.e2e-spec.ts`
- Test: `test/household-members.e2e-spec.ts`

**Interfaces:**

- Produces: new requests accept `admin_first_name/admin_last_name` and `first_name/last_name`; service derives compatibility `name` through `displayName(first, last)`.
- Consumes: columns from Task 1.

- [ ] **Step 1: Add failing DTO/service/e2e tests** for required new fields, normalization, dual-write and invite redemption persistence.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Create one shared name normalization/display helper** and use it in household creation, member invitation and redemption.
- [ ] **Step 4: Keep legacy request fields only behind an explicitly tested compatibility adapter** if the console FE cannot migrate in the same deployment.
- [ ] **Step 5: Run focused tests and verify pass.**
- [ ] **Step 6: Commit** as `feat(identity): dual-write structured member names`.

### Task 3: Self-service name change

**Files:**

- Create: `src/app-auth/dto/change-name.dto.ts`
- Modify: `src/app-auth/app-auth.controller.ts`
- Modify: `src/app-auth/app-auth.service.ts`
- Modify: `src/app-auth/app-auth.service.spec.ts`
- Modify: `src/app-auth/dto/app-auth-response.dto.ts`
- Test: `test/app-auth.e2e-spec.ts`

**Interfaces:**

- Produces: `PATCH /auth/me/name` accepting `{ first_name, last_name }` and returning the updated `AppProfile`.
- Consumes: shared display-name helper from Task 2 and the authenticated user id from `AuthGuard`.

- [ ] **Step 1: Add failing tests** for successful change, invalid/blank names, authenticated-only access, unchanged session id/auth version and immediate `GET /auth/me` visibility.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Implement DTO, service update and controller route** under `@NoTenant()` like the existing self-service auth routes.
- [ ] **Step 4: Return `first_name`, `last_name` and compatibility `name` from the updated profile and `GET /auth/me`.**
- [ ] **Step 5: Run focused tests and verify pass.**
- [ ] **Step 6: Commit** as `feat(profile): add self-service name changes`.

### Task 4: Member resource compatibility and verification

**Files:**

- Modify: `src/household-members/member-resource.ts`
- Modify: `src/household-members/dto/member-response.dto.ts`
- Modify: `src/household-members/member-resource.spec.ts`
- Modify: `test/household-members.e2e-spec.ts`
- Modify: `test/swagger.e2e-spec.ts`
- Modify: `notes/BE/BACKEND.md`

**Interfaces:**

- Produces: additive structured names on member list/invite responses; `name` remains present.
- Consumes: all previous name tasks.

- [ ] **Step 1: Add failing response tests** for active, pending, mononym legacy and tombstoned/former members.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Thread structured fields through member selection/resource/Swagger code** with null only for legacy mononyms.
- [ ] **Step 4: Document the compatibility window and future `name` removal criteria.**
- [ ] **Step 5: Run the complete BE gate:** `npm run type-check && npm run lint:ci && npm test && npm run test:e2e && npm run build`.
- [ ] **Step 6: Commit** as `feat(members): expose structured names compatibly`.
