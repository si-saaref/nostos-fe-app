# Household ledger foundation — planning index

Status: design approved; implementation not started.

## Source material

- Product and cross-stack design:
  `specs/2026-10-26-household-ledger-foundation-design.md`
- Product UX audit: `../ux-audit.md`

## Implementation plans

1. `plans/2026-10-26-be-household-defaults-catalogs.md`
2. `plans/2026-10-26-be-transfer-balances.md`
3. `plans/2026-10-26-be-member-names.md`
4. `plans/2026-10-26-fe-settings-my-account.md`
5. `plans/2026-10-26-fe-ledger-experience.md`

## Dependency order

```text
BE household prefs + system keys
  ├─> BE household defaults/backfill
  └─> BE account dates/reconciliation/positions summary

BE nullable transfer category
  └─> FE transfer flow

BE structured member names
  └─> FE My Account + member labels

All additive BE contracts
  ├─> FE Settings/My Account
  └─> FE ledger experience

FE category icon helper
  └─> FE ledger category icons
```

The three BE plans can be developed in parallel after their migrations are
ordered so they do not choose the same timestamp. FE contract adapters should
not ship against production until their corresponding additive BE fields and
routes are available.

## Recommended release sequence

1. **Expand:** deploy nullable/additive schema, prefs, aliases and response
   fields. Old FE remains functional.
2. **Migrate:** run and verify the idempotent household defaults/name backfills.
3. **Enforce:** enable account protection, transfer matrix and reconciliation.
4. **Cut over FE:** ship Settings and ledger plans behind the now-live contract.
5. **Observe:** compare positions totals and financial mutation errors in
   production.
6. **Contract later:** remove legacy routes/fields only in a separate approved
   release.

## Execution recommendation

Use subagent-driven implementation with a fresh review gate per task and a
whole-branch review per plan. This work crosses money calculations, database
constraints, backfills and two repositories; an unnoticed contract mismatch or
incorrect migration costs more than the additional review cycles.
