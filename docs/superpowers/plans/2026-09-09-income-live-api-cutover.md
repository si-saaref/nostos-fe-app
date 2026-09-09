# Income Live-API Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Point the shipped income UI at the live backend — flat routes, `type_id` as a foreign key, the two corrected error codes, the three server-answered month figures — and stop mocking the financial domain.

**Architecture:** The UI is already built and 64 tests cover it, all running against MSW handlers (`testHandlers` hardcodes `financial: true` and ignores `MOCKED`). The mocks are therefore the test fixture, which sets the TDD rhythm for every task: move the mock to the shipped contract first, watch the existing suite go red, then move the app. `src/test/setup.ts` runs `server.listen({ onUnhandledRequest: 'error' })`, so a request to a path no handler claims fails loudly rather than silently — that is what makes the two path changes testable at all.

**Tech Stack:** React 19 · TypeScript strict · TanStack Query 5 · react-hook-form 7 · MSW 2 · Vitest 4 · Testing Library · Tailwind v4 · paraglide

## Global Constraints

- **Spec:** `notes/FE-App/prd-income-fe.md` (vault: `/Volumes/BigBrain/my-vault/Nostos/FE-App/prd-income-fe.md`). Surface structure is owned by `docs/SURFACE-INCOME.md` and must not change on screen.
- **Branch:** `feat/implement-income`. Commit after every task.
- **Verify before claiming done:** `npm run test`, `npm run lint`, `npm run type-check` (per `.claude/rules.md`).
- **Comments:** only what the code cannot say — a constraint, a gotcha, why not the obvious thing. One or two lines. Never restate the line below. Prefer deleting a comment to padding it.
- **Backend:** flat routes, tenancy in `X-Household-ID`. `/api/v1/income`, `/api/v1/income/:id`, `/api/v1/income-types`, `/api/v1/income-types/:id`, `/api/v1/positions`.
- **`limit` max is 500.** `MAX_PAGE_SIZE` already matches; do not change it.
- **`amount`** is a JSON number, max 2 decimals, never rounded on the way out.
- **`from_source_id`** is nullable and `null` is a value, not an omission. It is the only field a PATCH may clear.
- **Error codes the API can emit** (from its OpenAPI enum): `VALIDATION_ERROR`, `INVALID_TYPE`, `INVALID_SOURCE`, `INVALID_USER`, `FUTURE_DATE`, `SAME_SOURCE`, `UNAUTHORIZED`, `FORBIDDEN`, `HOUSEHOLD_DELETION_PENDING`, `NOT_FOUND`, `CONFLICT`, `INVALID_STATE`, `HOUSEHOLD_MISMATCH`, `INTERNAL_SERVER_ERROR`, `UNPROCESSABLE_ENTITY`, `TOO_MANY_REQUESTS`, `SERVICE_UNAVAILABLE`. **`DUPLICATE_NAME` and `WHITELIST_VALIDATION` are not in it.**
- **Tests run with locale pinned to `id`** (`src/test/setup.ts`), so assert Indonesian copy.
- Do not add filters, search, sort or a month rail. Do not touch the expense surface except where a shared type requires it.

## File Structure

| File                                                    | Responsibility                       | Task       |
| ------------------------------------------------------- | ------------------------------------ | ---------- |
| `src/modules/financial/api/income.ts`                   | Income wire mapping + hooks          | 1, 5       |
| `src/mocks/handlers/income.ts`                          | Mock income routes                   | 1, 4, 5, 6 |
| `src/modules/financial/api/income.test.tsx`             | Income api tests                     | 1, 5, 6    |
| `src/modules/financial/pages/IncomePage.test.tsx`       | Page tests, two path overrides       | 1, 2, 5    |
| `src/modules/financial/api/positions.ts`                | Positions mapping + hook             | 2          |
| `src/mocks/handlers/positions.ts`                       | Mock positions route                 | 2          |
| `src/modules/financial/api/positions.test.tsx`          | Positions tests                      | 2          |
| `src/mocks/handlers/incomeTypes.ts`                     | Mock income-type routes              | 3          |
| `src/modules/settings/api/incomeTypes.test.tsx`         | New — pins the 409 code              | 3          |
| `src/mocks/fixtures/incomeTypes.ts`                     | Type seed + id helpers               | 5          |
| `src/mocks/fixtures/income.ts`                          | Income seed, now by type id          | 5          |
| `src/types/income.ts`                                   | `Income`, `WireIncome`, inputs       | 5          |
| `src/modules/financial/lib/incomeErrors.ts`             | Error → field map                    | 5          |
| `src/modules/financial/components/IncomeForm.tsx`       | Create/edit form                     | 5          |
| `src/modules/financial/components/IncomeForm.test.tsx`  | New — type id binding, archived type | 5          |
| `src/modules/financial/components/IncomePlate.test.tsx` | New — resolved type name             | 5          |
| `src/modules/settings/api/incomeTypes.ts`               | Income-type queries                  | 5          |
| `src/modules/financial/components/IncomePlate.tsx`      | Statement row                        | 5          |
| `src/modules/financial/components/IncomeStatement.tsx`  | Day shelves                          | 5          |
| `src/modules/financial/pages/IncomePage.tsx`            | Page container, name lookups         | 5          |
| `src/types/api.ts`                                      | `Totals` / `WireTotals`              | 6          |
| `src/mocks/handlers/shared.ts`                          | `WireMeta`                           | 6          |
| `src/modules/financial/lib/incomeFigures.ts`            | Month figures + guard                | 7          |
| `src/modules/financial/lib/incomeFigures.test.ts`       | Figures tests                        | 7          |
| `src/mocks/handlers/index.ts`                           | `MOCKED`, domain paths               | 8          |
| `src/mocks/handlers/index.test.ts`                      | Domain routing tests                 | 8          |
| `docs/SURFACE-INCOME.md`, `docs/API-SPEC-INCOME.md`     | Docs the cutover falsifies           | 9          |

**Task order rationale:** the two path changes (1, 2) and two code changes (3, 4) are small, independent and low-risk, so they land first and each commit stays green. The `type_id` migration (5) is the one large task, coupled by the type system across nine files and not safely splittable — a fixture speaking `type_id` while the domain speaks `type` is red everywhere with nothing committable in between. The three new totals (6, 7) build on nothing else. The flag flip (8) goes last so every prior task was proven against a mock that already matched the server.

---

### Task 1: Flat `/income` route

**Files:**

- Modify: `src/mocks/handlers/income.ts:151` (the `PATH` constant)
- Modify: `src/modules/financial/api/income.ts:36` (`basePath`) and its four call sites
- Modify: `src/modules/financial/api/income.test.tsx` (add one test)
- Modify: `src/modules/financial/pages/IncomePage.test.tsx:257` (path override)

**Interfaces:**

- Consumes: nothing.
- Produces: income requests go to `/api/v1/income` and `/api/v1/income/:id`. Later tasks' mock overrides must use these paths.

- [ ] **Step 1: Write the failing test**

Add to `src/modules/financial/api/income.test.tsx`, inside the existing `describe('useIncome')`. Import `server` at the top of the file: `import { server } from '@/mocks/server'`.

```tsx
it('calls the flat /income route, with tenancy in the header not the path', async () => {
  const seen: string[] = []
  const record = ({ request }: { request: Request }) => {
    seen.push(new URL(request.url).pathname)
  }
  server.events.on('request:start', record)

  const { result } = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
    wrapper: createWrapper(),
  })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  server.events.removeListener('request:start', record)

  expect(seen.some((path) => path.endsWith('/api/v1/income'))).toBe(true)
  expect(seen.some((path) => path.includes('/households/'))).toBe(false)
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/modules/financial/api/income.test.tsx -t "flat /income route"`
Expected: FAIL — the recorded pathname is `/api/v1/households/<id>/income`, so the first assertion is false and the second is true.

- [ ] **Step 3: Move the mock to the flat path**

In `src/mocks/handlers/income.ts`, replace the `PATH` constant:

```ts
const PATH = '*/api/v1/income'
```

The four handler registrations below it already read `PATH` and `` `${PATH}/:incomeId` ``, so they need no edit. Rename the route param nowhere — `params.incomeId` still resolves.

- [ ] **Step 4: Run the suite to confirm it is now red for the app, not the mock**

Run: `npx vitest run src/modules/financial/api/income.test.tsx`
Expected: FAIL — most tests error with an unhandled-request failure naming `/api/v1/households/<id>/income`, because `setup.ts` uses `onUnhandledRequest: 'error'`. This is the intended red.

- [ ] **Step 5: Move the client to the flat path**

In `src/modules/financial/api/income.ts`, replace the `basePath` helper:

```ts
/** Flat, with tenancy in `X-Household-ID` — the same shape as `/expenses`. */
const BASE_PATH = '/income'
```

Then update the four call sites, dropping the `householdId` argument:

- In `useIncome`'s `queryFn`: `apiClient.get<ApiEnvelope<WireIncome[]>>(BASE_PATH, {`
- In `useCreateIncome`'s `mutationFn`: `apiClient.post<ApiEnvelope<WireIncome>>(BASE_PATH, toIncomeBody(input))`
- In `useUpdateIncome`'s `mutationFn`: ``apiClient.patch<ApiEnvelope<WireIncome>>(`${BASE_PATH}/${id}`, toIncomePatch(patch))``
- In `useDeleteIncome`'s `mutationFn`: ``apiClient.delete(`${BASE_PATH}/${id}`)``

Also correct the file's header comment, which currently claims income is household-scoped in the path. Replace that paragraph with:

```ts
/**
 * Everything Income knows about the server, in one file — see `expenses.ts`
 * for why the key factory and all four writes are colocated.
 *
 * Routes are flat; tenancy travels in `X-Household-ID`. The query keys stay
 * household-scoped regardless, because two households must never share a
 * cache entry even when they share a URL.
 */
```

`incomeKeys` keeps its `householdId` parameter. Do not change it.

- [ ] **Step 6: Fix the page test's path override**

In `src/modules/financial/pages/IncomePage.test.tsx:257`, change the override path:

```tsx
      http.get('*/api/v1/income', () =>
```

- [ ] **Step 7: Run the tests and make sure they pass**

Run: `npx vitest run src/modules/financial/api/income.test.tsx src/modules/financial/pages/IncomePage.test.tsx`
Expected: PASS, including the new test.

- [ ] **Step 8: Commit**

```bash
git add src/mocks/handlers/income.ts src/modules/financial/api/income.ts \
  src/modules/financial/api/income.test.tsx \
  src/modules/financial/pages/IncomePage.test.tsx
git commit -m "$(cat <<'EOF'
feat: point income at the flat /income route

The shipped API is /api/v1/income with tenancy in X-Household-ID; the nested
path 404s. Query keys stay household-scoped — two households must not share a
cache entry even when they share a URL.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Flat `/positions`, with `from` required

**Files:**

- Modify: `src/mocks/handlers/positions.ts:63-64` (path), and the `from` handling
- Modify: `src/modules/financial/api/positions.ts` (`PositionScope`, path, params)
- Modify: `src/modules/financial/api/positions.test.tsx` (add two tests)
- Modify: `src/modules/financial/pages/IncomePage.test.tsx:174` (path override)

**Interfaces:**

- Consumes: nothing.
- Produces: `PositionScope` becomes `{ asOf: string; from: string }` — `from` **required**. `IncomePage` already passes `from: filters.dateFrom`, which is always set by `useIncomeFilters` (it defaults to the current month's first day), so no caller changes.

- [ ] **Step 1: Write the failing tests**

Add to `src/modules/financial/api/positions.test.tsx`. Add these imports at the top: `import { http } from 'msw'`, `import { server } from '@/mocks/server'`, and `import { apiClient } from '@/api/client'`.

```tsx
describe('the positions request', () => {
  it('calls the flat /positions route', async () => {
    const seen: string[] = []
    const record = ({ request }: { request: Request }) => {
      seen.push(new URL(request.url).pathname)
    }
    server.events.on('request:start', record)

    const { result } = renderHook(() => usePositions(HOUSEHOLD, SCOPE), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    server.events.removeListener('request:start', record)

    expect(seen.some((path) => path.endsWith('/api/v1/positions'))).toBe(true)
    expect(seen.some((path) => path.includes('/households/'))).toBe(false)
  })

  it('always sends both from and as_of, because the route requires them', async () => {
    const queries: URLSearchParams[] = []
    const record = ({ request }: { request: Request }) => {
      queries.push(new URL(request.url).searchParams)
    }
    server.events.on('request:start', record)

    const { result } = renderHook(() => usePositions(HOUSEHOLD, SCOPE), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    server.events.removeListener('request:start', record)

    const params = queries.find((q) => q.has('as_of'))
    expect(params?.get('as_of')).toBe(SCOPE.asOf)
    expect(params?.get('from')).toBe(SCOPE.from)
  })

  // The mock refuses what the server refuses, so an omitted `from` fails the
  // suite rather than the household's balance.
  it('is refused with a 400 when from is missing', async () => {
    await expect(
      apiClient.get('/positions', { params: { as_of: SCOPE.asOf } }),
    ).rejects.toMatchObject({ response: { status: 400 } })
  })
})
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/modules/financial/api/positions.test.tsx -t "the positions request"`
Expected: FAIL — the flat path is not registered, and the third test gets a `200` because the current mock treats `from` as optional.

- [ ] **Step 3: Move the mock to the flat path and require `from`**

In `src/mocks/handlers/positions.ts`, replace the handler's registration and its `from` handling:

```ts
export const positionHandlers = [
  http.get('*/api/v1/positions', async ({ request }) => {
    await pause(READ_LATENCY_MS)
    const params = new URL(request.url).searchParams
    const asOf = params.get('as_of')
    const from = params.get('from')

    // Both required by the shipped route. An omitted `from` is a rejection,
    // never a defaulted window: a silently-widened period would answer a
    // plausible balance for a question nobody asked.
    if (!asOf || !from) {
      return errorBody(
        400,
        'VALIDATION_ERROR',
        'from and as_of are both required',
      )
    }
    if (Number.isNaN(fromIsoDay(asOf).getTime())) {
      return errorBody(400, 'VALIDATION_ERROR', 'as_of must be YYYY-MM-DD')
    }
    if (Number.isNaN(fromIsoDay(from).getTime())) {
      return errorBody(400, 'VALIDATION_ERROR', 'from must be YYYY-MM-DD')
    }

    // The period opens at the close of the day before it starts, which is
    // what makes "opened September at" and "closed August at" the same
    // number rather than two figures a day apart.
    const openingAt = isoDay(shiftDays(fromIsoDay(from), -1))
```

Everything from `const rows: WirePosition[] = db.accounts` down to the closing `}),` is unchanged. Delete the now-unused `isoDay(new Date())` fallback; `isoDay` is still imported and used by `openingAt`.

- [ ] **Step 4: Run the tests to confirm the mock is right and the client is not**

Run: `npx vitest run src/modules/financial/api/positions.test.tsx`
Expected: FAIL — the existing tests now hit an unhandled request on the nested path.

- [ ] **Step 5: Move the client and make `from` required**

In `src/modules/financial/api/positions.ts`, replace the `PositionScope` interface and the `queryFn`'s request:

```ts
export interface PositionScope {
  /** The day the balance is true as of. */
  asOf: string
  /** First day of the period whose opening balance is wanted. Required by the route. */
  from: string
}
```

```ts
        await apiClient.get<ApiEnvelope<WirePosition[]>>('/positions', {
          params: { as_of: scope.asOf, from: scope.from },
        }),
```

Also update the doc comment's stale line: it says the endpoint "is not built yet", which is no longer true. Replace that sentence with:

```ts
 * `isError` is a designed state, not an edge case: a balance the client cannot
 * compute must degrade to a stated sentence rather than a zero that reads as
 * "you have nothing".
```

- [ ] **Step 6: Fix the page test's path override**

In `src/modules/financial/pages/IncomePage.test.tsx:174`:

```tsx
      http.get('*/api/v1/positions', () =>
```

- [ ] **Step 7: Run the tests and make sure they pass**

Run: `npx vitest run src/modules/financial/api/positions.test.tsx src/modules/financial/pages/IncomePage.test.tsx`
Expected: PASS.

- [ ] **Step 8: Type-check, because `PositionScope` narrowed**

Run: `npm run type-check`
Expected: PASS. `IncomePage.tsx` passes `from: filters.dateFrom`, which `useIncomeFilters` always populates. If TypeScript reports it as `string | undefined`, fix it at the call site with `from: filters.dateFrom ?? isoDay(month)` rather than widening `PositionScope` back.

- [ ] **Step 9: Commit**

```bash
git add src/mocks/handlers/positions.ts src/modules/financial/api/positions.ts \
  src/modules/financial/api/positions.test.tsx \
  src/modules/financial/pages/IncomePage.test.tsx
git commit -m "$(cat <<'EOF'
feat: point positions at the flat route and always send `from`

/api/v1/positions requires both `from` and `as_of`; the client sent `from`
conditionally, so an omission was a 400 rather than a defaulted window. Not in
API-SPEC-DEVIATIONS-INCOME.md — found in the shipped OpenAPI document, which
marks both required. The mock now refuses a missing `from` too, so an omission
fails the suite rather than the household's balance.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `409 CONFLICT` on a duplicate income-type name

**Files:**

- Modify: `src/mocks/handlers/incomeTypes.ts:49`
- Create: `src/modules/settings/api/incomeTypes.test.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces: the mock answers `409 CONFLICT`. The message text is unchanged, so `IncomeTypeSection.test.tsx:86` (which asserts on `/sudah ada/i`, not on the code) keeps passing untouched.

> **Note on the spec:** `prd-income-fe.md` §16.2 says `IncomeTypeSection.test.tsx` "changes, currently pinned on `DUPLICATE_NAME`". That is wrong — that test asserts the rendered _message_. Nothing pins the code today, which is why this task adds a test that does.

- [ ] **Step 1: Write the failing test**

Create `src/modules/settings/api/incomeTypes.test.tsx`:

```tsx
import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@/test/test-utils'
import { resetMockState } from '@/mocks/db'
import { MOCK_ME } from '@/mocks/fixtures/household'
import { INCOME_TYPE_NAMES } from '@/mocks/fixtures/incomeTypes'
import { useCreateIncomeType } from '@/modules/settings/api/incomeTypes'
import { getErrorCode, getErrorMessage } from '@/utils/errors'

const HOUSEHOLD = MOCK_ME.household_id

beforeEach(() => {
  resetMockState()
})

describe('useCreateIncomeType', () => {
  // CONFLICT, not DUPLICATE_NAME: the latter is not in the API's error enum
  // and never was, so a branch keyed on it could never fire.
  it('answers 409 CONFLICT for a name that exists, ignoring case', async () => {
    const { result } = renderHook(() => useCreateIncomeType(HOUSEHOLD), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ name: INCOME_TYPE_NAMES[0].toUpperCase() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(getErrorCode(result.current.error)).toBe('CONFLICT')
    expect(getErrorMessage(result.current.error)).toMatch(/sudah ada/i)
  })
})
```

Before running, confirm the mutation's argument shape matches `useCreateIncomeType` in `src/modules/settings/api/incomeTypes.ts:59`. If it takes a bare string rather than `{ name }`, call it as `result.current.mutate(INCOME_TYPE_NAMES[0].toUpperCase())`.

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/modules/settings/api/incomeTypes.test.tsx`
Expected: FAIL — `expected 'DUPLICATE_NAME' to be 'CONFLICT'`.

- [ ] **Step 3: Change the code the mock answers**

In `src/mocks/handlers/incomeTypes.ts`, replace line 49:

```ts
return errorBody(409, 'CONFLICT', `"${clash.name}" sudah ada`)
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run src/modules/settings/api/incomeTypes.test.tsx src/modules/settings/components/IncomeTypeSection.test.tsx`
Expected: PASS — both files. The section test asserts the message, which did not change.

- [ ] **Step 5: Commit**

```bash
git add src/mocks/handlers/incomeTypes.ts src/modules/settings/api/incomeTypes.test.tsx
git commit -m "$(cat <<'EOF'
feat: answer 409 CONFLICT for a duplicate income-type name

DUPLICATE_NAME is not in the API's error enum — /expense-types and
/payment-sources both already answer CONFLICT for this condition. Adds the test
that pins the code; the existing section test pins the message and is unchanged.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `household_id` in the body is `400 VALIDATION_ERROR`

**Files:**

- Modify: `src/mocks/handlers/income.ts` (the `badBody` whitelist branch)
- Modify: `src/modules/financial/api/income.test.tsx` (add one test)

**Interfaces:**

- Consumes: Task 1's flat `PATH`.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing test**

Add to `src/modules/financial/api/income.test.tsx`. It calls `apiClient` directly, because no client code can send this key — `toIncomeBody` never emits it, which is exactly why this rule is only reachable at the wire level. Add `import { apiClient } from '@/api/client'` and `import { getErrorCode } from '@/utils/errors'` at the top.

```tsx
describe('the income wire contract', () => {
  // VALIDATION_ERROR, not WHITELIST_VALIDATION: forbidNonWhitelisted raises a
  // standard validation failure, and WHITELIST_VALIDATION is not in the API's
  // error enum at all.
  it('refuses a body carrying household_id with a 400 VALIDATION_ERROR', async () => {
    const failure = await apiClient
      .post('/income', {
        name: 'Smuggled',
        amount: 1000,
        household_id: HOUSEHOLD,
        from_source_id: null,
        to_source_id: ACCOUNT_IDS[0],
        date: thisMonth.from,
      })
      .catch((error: unknown) => error)

    expect(getErrorCode(failure)).toBe('VALIDATION_ERROR')
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/modules/financial/api/income.test.tsx -t "household_id"`
Expected: FAIL — `expected 'WHITELIST_VALIDATION' to be 'VALIDATION_ERROR'`.

- [ ] **Step 3: Change the code the mock answers**

In `src/mocks/handlers/income.ts`, replace the first branch of `badBody`:

```ts
if ('household_id' in body) {
  return errorBody(400, 'VALIDATION_ERROR', 'Validation failed', [
    {
      field: 'household_id',
      code: 'WHITELIST',
      message: 'property household_id should not exist',
    },
  ])
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run src/modules/financial/api/income.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mocks/handlers/income.ts src/modules/financial/api/income.test.tsx
git commit -m "$(cat <<'EOF'
feat: refuse household_id in an income body as VALIDATION_ERROR

WHITELIST_VALIDATION is not a code this API emits; forbidNonWhitelisted raises
a standard validation failure with the offending key in details[]. Applies to
/expenses as much as to /income.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `type` becomes `type_id` — the foreign-key migration

The one large task. Nine files move together because the type system couples them: a fixture speaking `type_id` while the domain speaks `type` is red everywhere, with nothing committable in between.

**Files:**

- Modify: `src/mocks/fixtures/incomeTypes.ts` (add id helpers)
- Modify: `src/mocks/fixtures/income.ts` (rows carry `typeId`)
- Modify: `src/mocks/handlers/income.ts` (`type_id` on the wire, `422 INVALID_TYPE`)
- Modify: `src/types/income.ts` (`typeId` throughout)
- Modify: `src/modules/financial/api/income.ts` (three mappers)
- Modify: `src/modules/financial/lib/incomeErrors.ts` (field map)
- Modify: `src/modules/financial/components/IncomeForm.tsx` (bind the id, fetch all types)
- Modify: `src/modules/settings/api/incomeTypes.ts` (delete `useActiveIncomeTypes`)
- Modify: `src/modules/financial/components/IncomePlate.tsx` (`typeName` prop)
- Modify: `src/modules/financial/components/IncomeStatement.tsx` (thread `nameOfType`)
- Modify: `src/modules/financial/pages/IncomePage.tsx` (`useIncomeTypes` + `nameOfType`)
- Modify: `src/modules/financial/api/income.test.tsx`, `src/modules/financial/lib/incomeFigures.test.ts`, `src/modules/financial/pages/IncomePage.test.tsx` (rename)
- Create: `src/modules/financial/components/IncomePlate.test.tsx`
- Create: `src/modules/financial/components/IncomeForm.test.tsx`

**Interfaces:**

- Consumes: Task 1's `BASE_PATH`.
- Produces:
  - `Income.typeId: string`, `WireIncome.type_id: string`, `CreateIncomeInput.typeId: string`
  - `IncomeField` gains `'typeId'` and loses `'type'`
  - `IncomePlate` prop `typeName: string` (a resolved word, like the existing `fromName` / `toName` / `recorderName`)
  - `IncomeStatement` prop `nameOfType: (typeId: string) => string`
  - Fixtures export `INCOME_TYPE_IDS: string[]` and `incomeTypeIdOf(name: string): string`
  - `useActiveIncomeTypes` is **gone**. `useIncomeTypes(householdId)` is the only income-type query; callers filter `archivedAt` themselves.

> **Departs from the spec, deliberately.** `prd-income-fe.md` §9.2 says `useActiveIncomeTypes` "stays exactly as it is, for the form's picker". Writing the archived-type test showed that cannot work: with names as values an archived type labelled its own option, and with ids the label must be looked up in a list the archived type is absent from — so the picker would show a uuid, breaking AC2.4. The form fetches every type and filters live ones itself, which leaves `useActiveIncomeTypes` with no callers.

- [ ] **Step 1: Add the fixture id helpers**

In `src/mocks/fixtures/incomeTypes.ts`, append after `INCOME_TYPE_NAMES`:

```ts
/**
 * Ids matching what `seedIncomeTypes` assigns, so a fixture ledger and the
 * type catalogue cannot drift apart. Derived from the index rather than
 * written out twice.
 */
export const INCOME_TYPE_IDS: string[] = INCOME_TYPE_NAMES.map(
  (_, index) => `itype-${index}`,
)

export const incomeTypeIdOf = (name: string): string => {
  const index = (INCOME_TYPE_NAMES as readonly string[]).indexOf(name)
  // Throws rather than returning a dangling id: a fixture ledger pointing at a
  // type that was never seeded is the bug this helper exists to prevent.
  if (index === -1) throw new Error(`No seeded income type named "${name}"`)
  return INCOME_TYPE_IDS[index]
}
```

Leave `seedIncomeTypes` exactly as it is — it already produces `itype-${index}`.

- [ ] **Step 2: Write the failing tests**

**2a.** In `src/modules/financial/api/income.test.tsx`, replace the `toIncome` test's wire and expectation. Change the import `INCOME_TYPE_NAMES` to `INCOME_TYPE_IDS`, then in the `describe('toIncome')` block replace `type: 'salary',` with `type_id: 'itype-0',` in the wire object and `type: 'salary',` with `typeId: 'itype-0',` in the expectation.

In the same file, replace every `type: INCOME_TYPE_NAMES[0],` in the four `mutate({...})` calls with `typeId: INCOME_TYPE_IDS[0],`.

Then add:

```tsx
it('sends the type as an id, not a name', async () => {
  const bodies: unknown[] = []
  const record = async ({ request }: { request: Request }) => {
    if (request.method === 'POST') bodies.push(await request.clone().json())
  }
  server.events.on('request:start', record)

  const { result } = renderHook(() => useCreateIncome(HOUSEHOLD), {
    wrapper: createWrapper(),
  })
  result.current.mutate({
    name: 'Gaji',
    amount: 5000000,
    typeId: INCOME_TYPE_IDS[0],
    fromSourceId: null,
    toSourceId: ACCOUNT_IDS[0],
    date: thisMonth.from,
  })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  server.events.removeListener('request:start', record)

  expect(bodies[0]).toMatchObject({ type_id: INCOME_TYPE_IDS[0] })
  expect(bodies[0]).not.toHaveProperty('type')
  // null is a value on this field, not an omission — the key must be present.
  expect(bodies[0]).toHaveProperty('from_source_id', null)
  expect(result.current.data?.typeId).toBe(INCOME_TYPE_IDS[0])
})

it('refuses a type id the household does not have', async () => {
  const { result } = renderHook(() => useCreateIncome(HOUSEHOLD), {
    wrapper: createWrapper(),
  })
  result.current.mutate({
    name: 'Mystery',
    amount: 1000,
    typeId: 'itype-does-not-exist',
    fromSourceId: null,
    toSourceId: ACCOUNT_IDS[0],
    date: thisMonth.from,
  })

  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(getErrorCode(result.current.error)).toBe('INVALID_TYPE')
})
```

**2b.** Create `src/modules/financial/components/IncomePlate.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/test-utils'
import { IncomePlate } from '@/modules/financial/components/IncomePlate'
import type { Income } from '@/types/income'

const income: Income = {
  id: 'inc-1',
  name: 'Gaji bulan ini',
  amount: 8600000,
  typeId: 'itype-0',
  fromSourceId: null,
  toSourceId: 'source-bni',
  date: '2026-09-01',
  householdId: 'h1',
  createdByUserId: 'user-1',
}

const props = {
  income,
  rim: 1 as const,
  fromName: null,
  toName: 'BNI',
  recorderName: 'Sari',
  isOpen: false,
  onToggle: () => {},
  currency: 'IDR',
  canManage: false,
}

describe('IncomePlate', () => {
  // The row renders a word, never the uuid behind it.
  it('renders the resolved type name', () => {
    renderWithProviders(<IncomePlate {...props} typeName="gaji" />)

    expect(screen.getByText(/gaji/)).toBeInTheDocument()
    expect(screen.queryByText(/itype-0/)).not.toBeInTheDocument()
  })

  // An unresolvable id is an em dash: a uuid on screen is worse than an
  // admission that the word is gone.
  it('renders an em dash when the type cannot be resolved', () => {
    renderWithProviders(<IncomePlate {...props} typeName="—" />)

    expect(screen.queryByText(/itype-0/)).not.toBeInTheDocument()
    expect(screen.getByText(/—/)).toBeInTheDocument()
  })
})
```

**2c.** Create `src/modules/financial/components/IncomeForm.test.tsx`. Labels are Indonesian because `src/test/setup.ts` pins the locale to `id`.

```tsx
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { chooseOption, renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'
import { db } from '@/mocks/db'
import {
  INCOME_TYPE_IDS,
  INCOME_TYPE_NAMES,
} from '@/mocks/fixtures/incomeTypes'
import { ACCOUNT_IDS } from '@/mocks/fixtures/accounts'
import { IncomeForm } from '@/modules/financial/components/IncomeForm'
import type { Income } from '@/types/income'

describe('IncomeForm', () => {
  it('submits the type as an id, not the word on screen', async () => {
    const bodies: Record<string, unknown>[] = []
    const record = async ({ request }: { request: Request }) => {
      if (request.method === 'POST') {
        bodies.push((await request.clone().json()) as Record<string, unknown>)
      }
    }
    server.events.on('request:start', record)

    const onSuccess = vi.fn()
    renderWithProviders(<IncomeForm onSuccess={onSuccess} />)

    await userEvent.type(screen.getByLabelText(/keterangan/i), 'Gaji')
    await userEvent.type(screen.getByLabelText(/jumlah/i), '5000000')
    await chooseOption(/jenis/i, INCOME_TYPE_NAMES[0])
    await chooseOption(/masuk ke sumber/i, /./)
    await userEvent.click(screen.getByRole('button', { name: /catat/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    server.events.removeListener('request:start', record)

    expect(bodies[0].type_id).toBe(INCOME_TYPE_IDS[0])
    expect(bodies[0]).not.toHaveProperty('type')
  })

  // An admin correcting an amount must not silently retype the entry, and the
  // archived type's own word — not its uuid — is what has to be on screen.
  it('keeps an archived type selected on edit, showing its name', async () => {
    const archived = db.incomeTypes[1]
    archived.archivedAt = '2026-08-30T00:00:00.000Z'

    const income: Income = {
      id: 'inc-1',
      name: 'Bonus lama',
      amount: 4250000,
      typeId: archived.id,
      fromSourceId: null,
      toSourceId: ACCOUNT_IDS[0],
      date: '2026-08-12',
      householdId: db.incomeTypes[0].householdId,
    }

    renderWithProviders(<IncomeForm income={income} />)

    const trigger = await screen.findByRole('combobox', { name: /jenis/i })
    await waitFor(() => expect(trigger).toHaveTextContent(archived.name))
    expect(trigger).not.toHaveTextContent(archived.id)
  })
})
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `npx vitest run src/modules/financial/api/income.test.tsx src/modules/financial/components/IncomePlate.test.tsx src/modules/financial/components/IncomeForm.test.tsx`
Expected: FAIL — TypeScript/runtime errors on `typeId` and on the unknown `typeName` prop, and the archived-type test shows the uuid or an empty trigger.

- [ ] **Step 4: Move the fixture ledger to type ids**

In `src/mocks/fixtures/income.ts`, change the import and the `Recipe` interface:

```ts
import { MOCK_HOUSEHOLD, MOCK_USER } from '@/mocks/fixtures/household'
import { incomeTypeIdOf } from '@/mocks/fixtures/incomeTypes'
import { isoDay } from '@/utils/dates'
import type { StoredIncome } from '@/types/income'
```

In `Recipe`, rename the field to make the resolution explicit:

```ts
/** Resolved to a type id at seed time — the ledger stores the key, not the word. */
typeName: string
```

Rename the key in all ten `RECIPES` entries from `type:` to `typeName:` (values unchanged: `'gaji'`, `'tarik tunai'`, `'setoran'`, `'setoran'`, `'tarik tunai'`, `'bonus'`, `'tarik tunai'`, `'hadiah'`, `'setoran'`, `'tarik tunai'`).

In `seedIncome`'s `rows.push({...})`, replace `type: recipe.type,` with:

```ts
        typeId: incomeTypeIdOf(recipe.typeName),
```

- [ ] **Step 5: Move the mock handler to `type_id`**

In `src/mocks/handlers/income.ts`:

In `toWire`, replace `type: income.type,` with `type_id: income.typeId,`.

Replace the `body.type` branch of `badBody` with nothing — an unknown or archived type is a reference failure, not a field constraint, so it belongs in `badRef`. Delete these lines:

```ts
if (body.type !== undefined && !String(body.type).trim()) {
  return errorBody(400, 'VALIDATION_ERROR', 'Validation failed', [
    { field: 'type', code: 'IS_NOT_EMPTY', message: 'type is required' },
  ])
}
```

Add a live-type predicate beside `liveSource`:

```ts
const liveType = (id: string) =>
  db.incomeTypes.some((row) => row.id === id && row.archivedAt === null)
```

In `badRef`, add the type check as the first branch:

```ts
if (body.type_id !== undefined && !liveType(body.type_id)) {
  return errorBody(422, 'INVALID_TYPE', 'Jenis pemasukan tidak tersedia')
}
```

In the `POST` handler's `created` object, replace `type: body.type ?? '',` with:

```ts
      typeId: body.type_id ?? '',
```

Add a required-field guard beside the existing `to_source_id` one, at the top of the `POST` handler:

```ts
if (body.type_id === undefined) {
  return errorBody(400, 'VALIDATION_ERROR', 'Validation failed', [
    {
      field: 'type_id',
      code: 'IS_NOT_EMPTY',
      message: 'type_id is required',
    },
  ])
}
```

In the `PATCH` handler's spread, replace `...(body.type !== undefined && { type: body.type }),` with:

```ts
      ...(body.type_id !== undefined && { typeId: body.type_id }),
```

The PATCH's null-guard already covers `type_id`, because it rejects a `null` on any key but `from_source_id`.

- [ ] **Step 6: Move the domain types**

In `src/types/income.ts`:

In `Income`, replace the `type` field and its comment with:

```ts
/**
 * Foreign key into the household's `income_types`. The row stores the key,
 * not the word — so an archived type keeps naming the entries that used it,
 * and a renamed one renames its history with it.
 */
typeId: string
```

In `CreateIncomeInput`, replace `type: string` with `typeId: string`.

In `WireIncome`, replace `type: string` with `type_id: string`.

`UpdateIncomeInput` is `Partial<CreateIncomeInput>` and follows automatically. `IncomeType`, `WireIncomeType`, `StoredIncome`, `Position` and the rest are unchanged.

- [ ] **Step 7: Move the api mappers**

In `src/modules/financial/api/income.ts`:

In `toIncome`, replace `type: row.type,` with `typeId: row.type_id,`.

In `toIncomeBody`, replace `type: input.type,` with `type_id: input.typeId,`.

In `toIncomePatch`, replace the `type` branch with:

```ts
if (patch.typeId !== undefined) body.type_id = patch.typeId
```

- [ ] **Step 8: Move the error field map**

In `src/modules/financial/lib/incomeErrors.ts`, in `FIELD_BY_CODE` replace `INVALID_TYPE: 'type',` with `INVALID_TYPE: 'typeId',`. In `FIELD_BY_WIRE_NAME` replace `type: 'type',` with `type_id: 'typeId',`.

- [ ] **Step 9: Move the form to bind the id**

The picker used to bind the type's _name_, which meant an archived type could label its own option with the value it already held. Ids break that: the label has to be looked up, and the archived type is missing from a live-only list — so the form now fetches **every** type and filters the live ones itself. Otherwise the fallback option would read `itype-4`.

In `src/modules/financial/components/IncomeForm.tsx`:

Replace the import on line 11:

```ts
import { useIncomeTypes } from '@/modules/settings/api/incomeTypes'
```

Replace the hook call on line 51:

```ts
const { data: types } = useIncomeTypes(householdId)
```

Replace the `typeOptions` memo:

```tsx
/**
 * Live types to choose from, plus the one this row already carries even if
 * the household has since archived it.
 *
 * An admin correcting an amount must not silently retype the entry as
 * something else. That is why the whole list is fetched and filtered here
 * rather than asked for pre-filtered: an archived type is absent from a live
 * list, and its option would have to be labelled with its own uuid.
 */
const typeOptions = useMemo(() => {
  const all = types ?? []
  const live = all
    .filter((type) => !type.archivedAt)
    .map((type) => ({ value: type.id, label: type.name }))
  const current = income?.typeId
  if (!current || live.some((option) => option.value === current)) return live
  const archived = all.find((type) => type.id === current)
  return [...live, { value: current, label: archived?.name ?? current }]
}, [types, income])
```

Then delete `useActiveIncomeTypes` from `src/modules/settings/api/incomeTypes.ts` — this form was its only caller, and a `select`-filtered duplicate of a hook nobody calls is one more thing to keep in step. Its reasoning has moved into the memo above.

In `defaultValues`, replace `type: income?.type ?? '',` with `typeId: income?.typeId ?? '',`.

In the type `Controller`, change the field name and the clear target:

```tsx
<Controller
  control={control}
  name="typeId"
  rules={{ required: m.inc_err_type() }}
  render={({ field, fieldState }) => (
    <Select
      label={m.inc_form_type()}
      placeholder={m.form_choose()}
      value={field.value}
      onChange={changeAndClear('typeId', field.onChange)}
      error={fieldState.error?.message}
      disabled={typeOptions.length === 0}
      options={typeOptions}
    />
  )}
/>
```

- [ ] **Step 10: Move the plate to a resolved name**

In `src/modules/financial/components/IncomePlate.tsx`:

In `Props`, add beside `fromName` / `toName`:

```ts
/** Resolved from `income.typeId` by the page, like `fromName` and `toName`. */
typeName: string
```

Add `typeName,` to the destructured parameters of `IncomePlateBase`.

Replace `{income.type} · {recorderName}` with `{typeName} · {recorderName}`.

Replace the type `DetailField` with:

```tsx
<DetailField label={m.inc_plate_type()} value={typeName} />
```

- [ ] **Step 11: Thread the lookup through the statement**

In `src/modules/financial/components/IncomeStatement.tsx`:

In `Props`, add after `nameOfSource`:

```ts
nameOfType: (typeId: string) => string
```

Add `nameOfType,` to the destructured parameters.

In the `<IncomePlate>` invocation, add after `toName`:

```tsx
                  typeName={nameOfType(income.typeId)}
```

- [ ] **Step 12: Add the page's lookup**

In `src/modules/financial/pages/IncomePage.tsx`:

Add the import beside the existing settings-api imports:

```ts
import { useIncomeTypes } from '@/modules/settings/api/incomeTypes'
```

Beside the existing `useAccounts` call, add:

```ts
// Every type, not only the live ones: an archived type still names the
// entries recorded under it. Same query as the form's picker, so the page
// and the panel share one request.
const { data: incomeTypes } = useIncomeTypes(householdId)
```

Beside `nameOfSource`, add:

```ts
const nameOfType = useCallback(
  (typeId: string) =>
    incomeTypes?.find((type) => type.id === typeId)?.name ?? '—',
  [incomeTypes],
)
```

In the `<IncomeStatement>` invocation, add after `nameOfSource={nameOfSource}`:

```tsx
nameOfType = { nameOfType }
```

- [ ] **Step 13: Rename in the remaining tests**

In `src/modules/financial/lib/incomeFigures.test.ts`, in the `row` helper replace `type: 'gaji',` with `typeId: 'itype-0',`.

In `src/modules/financial/pages/IncomePage.test.tsx`, run `grep -n "type:" src/modules/financial/pages/IncomePage.test.tsx` and change any income row literal's `type: '<word>'` to `typeId: 'itype-0'`. Leave `type:` on non-income objects (form `type="submit"` attributes, expense rows) alone.

- [ ] **Step 14: Run the whole suite and make it pass**

Run: `npm run test`
Expected: PASS. Then `npm run type-check` — expected PASS. If it names a reader of `income.type` that this task missed, fix it the same way: resolve through `nameOfType` for display, `typeId` for data.

- [ ] **Step 15: Commit**

```bash
git add src/types/income.ts src/modules/financial src/mocks/fixtures/income.ts \
  src/mocks/fixtures/incomeTypes.ts src/mocks/handlers/income.ts \
  src/modules/settings/api/incomeTypes.ts
git commit -m "$(cat <<'EOF'
feat: bind income type by id, not by name

income_types is a real foreign key on the shipped API (`type_id`, uuid), not the
VARCHAR the FE contract assumed. The picker binds the id the way it already
binds source_id; the statement resolves it back to a word through nameOfType,
the sibling of nameOfSource.

Every type is fetched, not only the live ones: an archived type still names the
entries recorded under it, and the form needs its word to label the option a
row already holds. That left useActiveIncomeTypes with no callers, so it goes.
An unresolvable id renders an em dash — a uuid on screen is worse than an
admission.

The mock now refuses an unknown or archived type with 422 INVALID_TYPE, which
is a reference failure rather than the field constraint it used to be.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: The three extra `meta.totals` keys

**Files:**

- Modify: `src/types/api.ts` (`WireTotals`, `Totals`)
- Modify: `src/mocks/handlers/shared.ts` (`WireMeta`)
- Modify: `src/mocks/handlers/income.ts` (`metaFor`)
- Modify: `src/modules/financial/api/income.test.tsx` (add one test)

**Interfaces:**

- Consumes: Task 5's `typeId`.
- Produces: `Totals` gains optional `moved`, `externalCount`, `transferCount`. Task 7 reads them.

> The keys are **optional**, not required. Expenses answer three; income answers six; one shape holds both. Making them required would make every expense page a type error, and defaulting them to zero would be a claim about the household's money the server never made. `unwrapPage` already spreads `meta.totals` wholesale, so no `client.ts` change is needed — but it spreads _wire_ keys, so the domain `Totals` uses the snake names' camel equivalents only where `unwrapPage` maps them. It does not map: it spreads. **So the domain type must carry the wire spelling for these three.** See Step 3.

- [ ] **Step 1: Write the failing test**

Add to `src/modules/financial/api/income.test.tsx`, inside `describe('useIncome')`:

```tsx
it('surfaces the three figures the server computes over the whole set', async () => {
  const { result } = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
    wrapper: createWrapper(),
  })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))

  const items = result.current.data?.items ?? []
  const transfers = items.filter((row) => row.fromSourceId !== null)
  const totals = result.current.data?.totals

  expect(totals?.transfer_count).toBe(transfers.length)
  expect(totals?.external_count).toBe(items.length - transfers.length)
  expect(totals?.moved).toBe(
    transfers.reduce((sum, row) => sum + row.amount, 0),
  )
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/modules/financial/api/income.test.tsx -t "three figures"`
Expected: FAIL — a TypeScript error that `transfer_count` is not on `Totals`, and `undefined` at runtime.

- [ ] **Step 3: Widen the totals types**

In `src/types/api.ts`, replace both interfaces:

```ts
/**
 * `moved`, `external_count` and `transfer_count` are income-only and therefore
 * optional: expenses answer three keys, income six, and one shape holds both.
 * Absent is not zero — a zero here would be a claim about the household's
 * money that the server never made.
 */
export interface WireTotals {
  sum: number
  count: number
  average: number
  moved?: number
  external_count?: number
  transfer_count?: number
}
```

```ts
export interface Totals {
  sum: number
  count: number
  average: number
  moved?: number
  external_count?: number
  transfer_count?: number
}
```

The wire spelling survives into the domain type for these three because `unwrapPage` spreads `meta.totals` rather than mapping it key by key (`src/api/client.ts:88`). Keeping the two shapes identical is what makes that spread honest; renaming them would need a mapper, and a mapper that silently dropped a key is the failure this contract is arranged to avoid.

In `src/mocks/handlers/shared.ts`, replace `WireMeta`'s `totals` line so the mock can emit them:

```ts
  totals?: {
    sum: number
    count: number
    average: number
    moved?: number
    external_count?: number
    transfer_count?: number
  }
```

- [ ] **Step 4: Make the mock compute them**

In `src/mocks/handlers/income.ts`, replace `metaFor`'s return block. Its `into` / `outOf` / `sum` lines are unchanged above it:

```ts
const transfers = items.filter((row) => row.fromSourceId !== null)
return {
  pagination: {
    page,
    limit,
    total: items.length,
    total_pages: Math.max(1, Math.ceil(items.length / limit)),
  },
  // Over the whole filtered set, not the page — the client renders these as
  // month figures, and a figure that changed when you turned the page would
  // be reporting nothing.
  totals: {
    sum,
    count: items.length,
    average: averageMoney(sum, items.length),
    moved: outOf,
    external_count: items.length - transfers.length,
    transfer_count: transfers.length,
  },
}
```

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `npx vitest run src/modules/financial/api/income.test.tsx && npm run type-check`
Expected: PASS both.

- [ ] **Step 6: Commit**

```bash
git add src/types/api.ts src/mocks/handlers/shared.ts src/mocks/handlers/income.ts \
  src/modules/financial/api/income.test.tsx
git commit -m "$(cat <<'EOF'
feat: carry income's three extra meta.totals figures

The income list answers `moved`, `external_count` and `transfer_count`
alongside sum/count/average, all over the whole filtered set. Optional on the
shared Totals shape because expenses answer three keys and income six; absent
is not zero.

unwrapPage already spreads meta.totals wholesale, so no client change — which
is also why the domain type keeps the wire spelling for these three.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Month figures come from the server, with the guard as fallback

**Files:**

- Modify: `src/modules/financial/lib/incomeFigures.ts`
- Modify: `src/modules/financial/lib/incomeFigures.test.ts`

**Interfaces:**

- Consumes: Task 6's `Totals.moved` / `external_count` / `transfer_count`.
- Produces: `incomeMonthFigures` keeps its signature — `(page: Paginated<Income> | undefined) => IncomeMonthFigures`. `InflowStrip` needs no change.

> **Why the guard survives.** `meta.totals` is documented in `prd-income-be.md` §4.5 but **not modelled in the shipped OpenAPI schema**, which declares `meta: { pagination }` and marks only `pagination` required. Its presence is unproven until someone signs in (see the plan's §18 walkthrough item). Deleting the guard on the strength of a document would mean three strip cells rendering `undefined` if the keys turn out absent. The guard is still correct for anything the server does not answer; it simply has less to cover.

- [ ] **Step 1: Write the failing tests**

Add to `src/modules/financial/lib/incomeFigures.test.ts`. First widen the local `page` helper's `totals` parameter so a test can pass the new keys:

```ts
const page = (
  items: Income[],
  total = items.length,
  totals?: Partial<Paginated<Income>['totals']> & {
    sum: number
    count: number
    average: number
  },
): Paginated<Income> => ({
  items,
  pagination: { page: 1, limit: 400, total, totalPages: 1 },
  totals: totals ?? { sum: 0, count: total, average: 0 },
})
```

Then add:

```ts
// The whole point of the server answering these: the guard could only ever
// render a dash here, and the server has every row.
it('uses the server figures even when the page holds only part of the set', () => {
  const figures = incomeMonthFigures(
    page([row('salary', 5000000, null)], 40, {
      sum: 5000000,
      count: 40,
      average: 125000,
      moved: 1685000,
      external_count: 1,
      transfer_count: 39,
    }),
  )

  expect(figures.isComplete).toBe(true)
  expect(figures.moved).toBe(1685000)
  expect(figures.externalCount).toBe(1)
  expect(figures.transferCount).toBe(39)
})

it('prefers the server figures over its own derivation', () => {
  const figures = incomeMonthFigures(
    page([row('withdraw', 400000, 'source-bni')], 1, {
      sum: 0,
      count: 1,
      average: 0,
      moved: 999000,
      external_count: 0,
      transfer_count: 1,
    }),
  )

  expect(figures.moved).toBe(999000)
})

// The fallback: the schema does not model `totals`, so absence is a real case.
it('falls back to the guarded derivation when the server sends no figures', () => {
  const complete = incomeMonthFigures({
    items: [row('withdraw', 400000, 'source-bni')],
    pagination: { page: 1, limit: 400, total: 1, totalPages: 1 },
    totals: undefined,
  })
  expect(complete.moved).toBe(400000)
  expect(complete.isComplete).toBe(true)

  const partial = incomeMonthFigures({
    items: [row('withdraw', 400000, 'source-bni')],
    pagination: { page: 1, limit: 400, total: 40, totalPages: 1 },
    totals: undefined,
  })
  expect(partial.moved).toBeNull()
  expect(partial.isComplete).toBe(false)
})
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/modules/financial/lib/incomeFigures.test.ts`
Expected: FAIL — the first two tests get `null` / `false`, because today's implementation returns `UNKNOWN` for any page whose `items.length < pagination.total` and never reads `totals`.

- [ ] **Step 3: Read the server's figures first, keep the derivation second**

In `src/modules/financial/lib/incomeFigures.ts`, replace the file's doc comment and `incomeMonthFigures`. `IncomeMonthFigures` and `UNKNOWN` are unchanged.

Replace the doc comment above `IncomeMonthFigures` with:

```ts
/**
 * The three month figures that separate money which arrived from money which
 * merely moved, and the flag that says whether they may be shown.
 *
 * The server computes all three over the whole filtered set, so when
 * `meta.totals` carries them they are simply true — a partial page included.
 * When it does not, they are derived from the rows on hand, which is honest
 * only while the page holds every row in the set: hence the guard, and hence
 * `null` rather than a partial sum. A dash is a true statement about what is
 * known; a partial total is a false statement about the household's month.
 *
 * The fallback is not dead code. `meta.totals` is absent from the API's own
 * OpenAPI schema, so a deployment that does not send it is a real case.
 */
```

Replace `incomeMonthFigures`:

```ts
export const incomeMonthFigures = (
  page: Paginated<Income> | undefined,
): IncomeMonthFigures => {
  if (!page) return UNKNOWN

  const {
    moved,
    external_count: external,
    transfer_count: transfers,
  } = page.totals ?? {}
  if (
    moved !== undefined &&
    external !== undefined &&
    transfers !== undefined
  ) {
    return {
      externalCount: external,
      transferCount: transfers,
      moved,
      isComplete: true,
    }
  }

  if (page.items.length < page.pagination.total) return UNKNOWN

  const moving = page.items.filter((row) => row.fromSourceId !== null)
  return {
    externalCount: page.items.length - moving.length,
    transferCount: moving.length,
    moved: sumMoney(moving.map((row) => row.amount)),
    isComplete: true,
  }
}
```

All three keys are required together, not each on its own: a response carrying two of them is a contract the client does not know how to read, and guessing the third would put an invented figure on the strip.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run src/modules/financial/lib/incomeFigures.test.ts`
Expected: PASS — all eight tests, the five original ones included. The original "reports nothing when the page does not hold the whole filtered set" test still passes because its `page` helper supplies only `sum`/`count`/`average`.

- [ ] **Step 5: Run the page tests, which render the strip**

Run: `npx vitest run src/modules/financial/pages/IncomePage.test.tsx`
Expected: PASS. The mock now sends the three keys, so the strip's cells render real figures where they may previously have rendered a dash. If a test asserted on a dash for a _complete_ page it will still pass; if one asserted a dash for a partial page, update it — the figure is now correct and that assertion encoded the old limitation.

- [ ] **Step 6: Commit**

```bash
git add src/modules/financial/lib/incomeFigures.ts \
  src/modules/financial/lib/incomeFigures.test.ts \
  src/modules/financial/pages/IncomePage.test.tsx
git commit -m "$(cat <<'EOF'
feat: take the month's moved/external/transfer figures from the server

The income list computes all three over the whole filtered set, so they are
true on a partial page too — where the client's own derivation could only ever
render a dash.

The guard stays as the fallback rather than being deleted: meta.totals is
absent from the API's OpenAPI schema, so a deployment that does not send it is
a real case, and three cells rendering undefined is a worse failure than a
dash. All three keys are required together — two of three is a contract the
client cannot read, and guessing the third would invent a figure.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Stop mocking the financial domain

**Files:**

- Modify: `src/mocks/handlers/index.ts` (`MOCKED`, `DOMAIN_PATHS`, the type comment)
- Modify: `src/mocks/handlers/index.test.ts` (two path assertions)

**Interfaces:**

- Consumes: Tasks 1–7. Every route the app calls must already match the server before this flips.
- Produces: the browser worker no longer intercepts the financial domain. `testHandlers` is unaffected and still mocks it.

> **This takes expenses live too.** `financial` is deliberately one flag: both ledgers share `/payment-sources` and `/members`, and a position spans both at once, so a live-expense / mock-income world cannot produce a correct balance for any source. Expenses ran live between 2026-09-07 and 2026-09-08 and have ridden on mocks since. `prefs` stays `true` — the route 404s.

- [ ] **Step 1: Write the failing test**

In `src/mocks/handlers/index.test.ts`, replace the two nested paths in the test named `'mocks income, its types and the positions route alongside expenses'`:

```tsx
        '*/api/v1/income',
        '*/api/v1/income/:incomeId',
        '*/api/v1/income-types',
        '*/api/v1/positions',
```

Then add to `describe('isLiveApiPath')`:

```tsx
it.each([
  '/api/v1/income',
  '/api/v1/income/8c14e2a0-5b73-4f19-9d62-0a3e7c81f45b',
  '/api/v1/income-types',
  '/api/v1/income-types/itype-0',
  '/api/v1/positions',
])('reports %s as live once the financial domain is', (pathname) => {
  expect(isLiveApiPath(pathname, ALL_LIVE)).toBe(true)
  expect(isLiveApiPath(pathname, ALL_MOCKED)).toBe(false)
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/mocks/handlers/index.test.ts`
Expected: FAIL — `DOMAIN_PATHS.financial` still matches only the nested income and positions regexes, so `isLiveApiPath('/api/v1/income', ALL_LIVE)` is `false`.

- [ ] **Step 3: Update the domain paths**

In `src/mocks/handlers/index.ts`, replace `DOMAIN_PATHS.financial`:

```ts
  financial: [
    '/api/v1/expenses',
    '/api/v1/expense-types',
    '/api/v1/payment-sources',
    '/api/v1/income-types',
    '/api/v1/income',
    '/api/v1/positions',
    /\/api\/v1\/households\/[^/]+\/members(\/|$)/,
  ],
```

`'/api/v1/income'` is matched with `includes`, so it covers `/income/:id` and — harmlessly — `/income-types`, which is listed anyway. `/positions` needs no regex now that it is flat.

- [ ] **Step 4: Run the test and make sure it passes**

Run: `npx vitest run src/mocks/handlers/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Flip the flag**

In `src/mocks/handlers/index.ts`, replace the `MOCKED` block and its comment:

```ts
export const MOCKED: MockedDomains = {
  auth: false, // shipped 2026-09-01
  financial: false, // shipped 2026-09-09 — both ledgers, catalogue and positions
  prefs: true, // route not built: the live API 404s
}
```

In the `MockDomain` doc comment above it, the two paragraphs explaining why `financial` is one flag **stay** — the reasoning holds and is why both ledgers moved together. Replace only the closing sentence, which explains why it was `true`:

```ts
 * So it is one flag, and flipping it moves the whole financial world at once —
 * which is what happened on 2026-09-09, when `/income`, `/income-types` and
 * `/positions` shipped and expenses came off mocks with them.
 */
```

- [ ] **Step 6: Run everything**

Run: `npm run test && npm run lint && npm run type-check`
Expected: PASS all three. The suite is unaffected by `MOCKED` — `testHandlers` passes `financial: true` explicitly — so a green suite here proves the flag change did not disturb the tests, not that the live API works. That is what Task 9's walkthrough is for.

- [ ] **Step 7: Commit**

```bash
git add src/mocks/handlers/index.ts src/mocks/handlers/index.test.ts
git commit -m "$(cat <<'EOF'
feat: stop mocking the financial domain

/income, /income-types and /positions have shipped, so the last reason the
financial flag was true is gone. One flag covers both ledgers on purpose — they
share a catalogue, and a position spans both at once — so this takes expenses
live again alongside income. prefs stays mocked: the route still 404s.

testHandlers is unaffected and still mocks financial, so the suite proves the
flip disturbed nothing. Proving the live API is notes/FE-App/prd-income-fe.md
§18.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Doc hygiene

**Files:**

- Modify: `docs/SURFACE-INCOME.md` (§6, §7)
- Modify: `docs/API-SPEC-INCOME.md` (add a banner)

**Interfaces:**

- Consumes: Tasks 1–8.
- Produces: nothing in code.

> `docs/SURFACE-INCOME.md` declares that code disagreeing with it is a bug, so leaving it asserting the old contract inverts its own authority. This task is not optional polish.

- [ ] **Step 1: Rewrite `SURFACE-INCOME.md` §6**

Replace the whole of §6 (`## 6. Client-derived figures are guarded`, lines 114–121) with:

```markdown
## 6. The month's three extra figures come from the server

`meta.totals` carries six keys, not three: `sum`, `count` and `average`, plus `moved`,
`external_count` and `transfer_count` — all computed over the whole filtered set. So "moved
between sources", "entries from outside" and the transfer count are simply true, on a partial
page as much as a complete one.

`incomeMonthFigures` keeps its old derivation as a **fallback**, guarded against
`pagination.total` and rendering `—` rather than a partial sum. That path is not dead code:
`meta.totals` is absent from the API's own OpenAPI schema, so a deployment that does not send
it is a real case, and three cells rendering `undefined` is a worse failure than a dash.

The guard is still right for anything the server does not answer. It simply has less to cover.
```

- [ ] **Step 2: Rewrite `SURFACE-INCOME.md` §7's contract block**

In §7, replace the route line and the two bullets that follow the code fence's opening:

```markdown
GET /api/v1/positions?from=YYYY-MM-DD&as_of=YYYY-MM-DD

data: [{ source_id, opening_balance, balance }]
```

**Both parameters are required.** An omitted `from` is a `400`, never a defaulted window: a
silently-widened period would answer a plausible balance for a question nobody asked.

````

Then replace the section's final paragraph — the one beginning **"Until it is live"** — with:

```markdown
`PositionCard` renders a **stated degraded band on error**: no number, a plain sentence, and
the statement below still complete and correct. Never a guessed balance, never a zero standing
in for an unknown. The endpoint shipped on 2026-09-09; the band remains the designed failure
state, not a placeholder.
````

And in the same section fix the dangling reference — `docs/API-CONTRACT-INCOME.md` does not exist:

```markdown
The full inventory of what the BE serves is in `docs/API-SPEC-INCOME.md`, superseded in part
by `notes/BE/API-SPEC-DEVIATIONS-INCOME.md` and §10 of `notes/FE-App/prd-income-fe.md`.
```

- [ ] **Step 3: Banner `docs/API-SPEC-INCOME.md`**

Insert immediately after the file's title line:

```markdown
> ## ⚠️ Superseded in part — read `notes/FE-App/prd-income-fe.md` §10 first
>
> **Updated 2026-09-09.** The income API shipped, and three things this document proposes are
> not what it does. Where they disagree, **the shipped contract wins**:
>
> | Topic                    | This document                                         | Shipped                                                              |
> | ------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------- |
> | Routes                   | `/households/:id/income`, `/households/:id/positions` | **Flat**: `/income`, `/positions`. Tenancy in `X-Household-ID`       |
> | Type field               | `type`, a `VARCHAR` holding the word                  | **`type_id`**, a uuid foreign key                                    |
> | Duplicate type name      | `409 DUPLICATE_NAME`                                  | **`409 CONFLICT`** — `DUPLICATE_NAME` is not in the API's error enum |
> | `household_id` in a body | `400 WHITELIST_VALIDATION`                            | **`400 VALIDATION_ERROR`** — likewise not in the enum                |
> | `meta.totals`            | three keys                                            | **six**: plus `moved`, `external_count`, `transfer_count`            |
> | `/positions` params      | `as_of` required, `from` optional                     | **both required**                                                    |
>
> §1 of this document — what the BE already provided, and that income needs no change to any
> of it — remains correct in full.
```

- [ ] **Step 4: Verify nothing else asserts the old contract**

Run:

```bash
grep -rn "households/:id/income\|households/:householdId/income\|households/:id/positions\|DUPLICATE_NAME\|WHITELIST_VALIDATION\|API-CONTRACT-INCOME" docs src
```

Expected: no hits in `src/`. Hits in `docs/API-SPEC-INCOME.md` are fine — that document now carries a banner saying so. If anything in `src/` still matches, fix it; a comment asserting a dead code path is a trap for the next reader.

- [ ] **Step 5: Commit**

```bash
git add docs/SURFACE-INCOME.md docs/API-SPEC-INCOME.md
git commit -m "$(cat <<'EOF'
docs: reconcile the income surface brief with the shipped API

SURFACE-INCOME.md §6 said meta.totals carries "sum, count, average and nothing
else" and mandated the guard; the server now answers all three extra figures
and the guard is the fallback. §7 printed the nested positions path, was
written in "until it is live" tense, and cited a file that does not exist.

That document declares code disagreeing with it to be a bug, so leaving it
stale inverted its own authority. API-SPEC-INCOME.md gets a superseded-in-part
banner naming all six deviations.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification

- [ ] `npm run test` — all green
- [ ] `npm run lint` — clean
- [ ] `npm run type-check` — clean
- [ ] `grep -rn "\.type\b" src/modules/financial | grep -i income` returns no income-row reader still using the old field
- [ ] Then run the signed-in walkthrough in `notes/FE-App/prd-income-fe.md` §18, together with the still-unrun expense checklist in `notes/BE/CUTOVER-2026-09-07.md`. Two items there are genuinely unproven: whether `meta.totals` carries the three new keys, and whether the session cookie survives cross-origin. A cookie failure is a CORS problem, not an income bug — the local workaround is the `/api` proxy in `vite.config.ts`.
