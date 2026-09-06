# Expense API Deviations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the frontend with the eight API deviations backend reported in `notes/BE/API-SPEC-DEVIATIONS.md`.

**Architecture:** Three shared readers in `src/utils/errors.ts` learn the real error envelope (including the `error.details` nesting). A new module-owned map in `src/modules/financial/lib/` turns backend error codes into expense form field names, which `ExpenseForm` applies with react-hook-form's `setError`. Separately, `AccountKind` is split into a wire type (uppercase) and a domain type (lowercase) with mapping in `settings/api/accounts.ts`.

**Tech Stack:** React 19, TypeScript, react-hook-form 7.83, TanStack Query 5, axios 1.18, MSW mocks, Vitest + Testing Library, Paraglide i18n.

## Global Constraints

- **Test command:** `npm test` (vitest run). Single file: `npx vitest run <path>`.
- **Type check:** `npm run type-check`. Lint: `npm run lint`. Both must pass before each commit.
- **`erasableSyntaxOnly: true`** is set in `tsconfig.app.json` — TS `enum` is a compile error. Use `as const` objects with derived unions, as `theme/themes.ts` does.
- **Wire types are snake_case, domain types are camelCase.** Every wire↔domain hop is an explicit lookup record or a spelled-out mapper — never a string transform. Reason: `SORT_COLUMN` in `expenses.ts:38`.
- **Server error messages render verbatim.** `error.message` is often the whole feature (the invite 409s differ per case on purpose). Never substitute generic copy for it. This means the 422 field errors need **no new i18n strings**.
- **i18n:** UI copy lives in `messages/en.json` and `messages/id.json`, accessed as `m.key()` via `useMessages()`. Both files must be updated together. Tests assert against **Indonesian** copy (`id.json` is the base locale).
- **`noUncheckedIndexedAccess` is OFF.** A bare `Record<string, X>` index types as `X`, so any lookup table whose misses are handled at runtime must be typed `Record<string, X | undefined>` — otherwise the guard reads as dead code to the next reader.
- **Prettier runs on commit** via husky + lint-staged. Do not fight its formatting.
- **Commit style:** conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).

---

## File Structure

| File                                                | Responsibility                                                  | Task |
| --------------------------------------------------- | --------------------------------------------------------------- | ---- |
| `src/utils/errors.ts`                               | Modify — the only place that knows the error envelope's shape   | 1    |
| `src/utils/errors.test.ts`                          | Create — envelope reader tests                                  | 1    |
| `src/modules/auth/signin/signin.ts`                 | Modify — use the shared details reader                          | 2    |
| `src/mocks/handlers/auth.ts`                        | Modify — nest `details` inside `error`                          | 2    |
| `src/modules/financial/lib/expenseErrors.ts`        | Create — backend code → expense form field                      | 3    |
| `src/modules/financial/lib/expenseErrors.test.ts`   | Create                                                          | 3    |
| `src/modules/financial/components/ExpenseForm.tsx`  | Modify — apply field errors, clear on edit                      | 4    |
| `src/mocks/handlers/expenses.ts`                    | Modify — 422 cases so the form is exercisable                   | 4    |
| `src/types/catalog.ts`                              | Modify — split `WireAccountKind` from `AccountKind`             | 5    |
| `src/modules/settings/api/accounts.ts`              | Modify — map `kind` both directions                             | 5    |
| `src/mocks/handlers/accounts.ts`                    | Modify — uppercase on the wire only                             | 5    |
| `src/modules/settings/components/MemberSection.tsx` | Modify — append the deletion date to the invite error           | 6    |
| `src/mocks/handlers/members.ts`                     | Modify — the invite 403; split the existing resend 409 per case | 6    |
| `messages/{en,id}.json`                             | Modify — one key for the deletion deadline suffix               | 6    |
| `src/utils/money.ts`                                | Modify — remove the dead decimal constants                      | 7    |

**Note — a correction to the spec.** Spec §4.4 says `mocks/fixtures/accounts.ts` moves to uppercase. It does not: the fixture is typed `Account[]` (the _domain_ type) and the handler's `toWire` converts. Only the handler changes. Task 5 reflects this.

---

### Task 1: Envelope readers

**Files:**

- Modify: `src/utils/errors.ts`
- Test: `src/utils/errors.test.ts` (create)

**Interfaces:**

- Consumes: `ApiErrorBody`, `ApiFieldError` from `@/types/api` (both already exist).
- Produces:
  - `getErrorCode(error: unknown): string | undefined`
  - `getErrorDetails(error: unknown): unknown`
  - `getFieldErrors(error: unknown): ApiFieldError[]`

Tasks 2, 3 and 6 all depend on these three.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/errors.test.ts`:

```ts
import { AxiosError } from 'axios'
import {
  getErrorCode,
  getErrorDetails,
  getErrorMessage,
  getFieldErrors,
} from '@/utils/errors'

/** A real AxiosError — every reader guards on `axios.isAxiosError`. */
const axiosError = (status: number, data?: unknown): AxiosError => {
  const error = new AxiosError('Request failed', 'ERR_BAD_RESPONSE')
  error.response = { status, data } as AxiosError['response']
  return error
}

describe('getErrorCode', () => {
  it('reads the code from the envelope', () => {
    const error = axiosError(422, {
      success: false,
      error: { code: 'INVALID_TYPE', message: 'Unknown category' },
    })
    expect(getErrorCode(error)).toBe('INVALID_TYPE')
  })

  it('is undefined for a non-axios error', () => {
    expect(getErrorCode(new Error('boom'))).toBeUndefined()
  })

  it('is undefined when the body carries no error block', () => {
    expect(getErrorCode(axiosError(500, {}))).toBeUndefined()
  })
})

describe('getErrorDetails', () => {
  it('reads details nested under error — the shape the API sends', () => {
    const error = axiosError(403, {
      error: {
        code: 'HOUSEHOLD_DELETION_PENDING',
        details: { deletion_scheduled_for: '2026-09-26' },
      },
    })
    expect(getErrorDetails(error)).toEqual({
      deletion_scheduled_for: '2026-09-26',
    })
  })

  it('falls back to the flat shape, so a stale deployment still resolves', () => {
    const error = axiosError(403, {
      error: { code: 'HOUSEHOLD_DELETION_PENDING' },
      details: { deletion_scheduled_for: '2026-09-26' },
    })
    expect(getErrorDetails(error)).toEqual({
      deletion_scheduled_for: '2026-09-26',
    })
  })

  // Deviation #5: details is omitted, not null, when empty.
  it('is undefined when details is absent from both places', () => {
    expect(
      getErrorDetails(axiosError(422, { error: { code: 'X' } })),
    ).toBeUndefined()
  })
})

describe('getFieldErrors', () => {
  it('returns one entry per failed constraint', () => {
    const error = axiosError(400, {
      error: {
        code: 'VALIDATION_ERROR',
        details: [
          { field: 'date_paid', code: 'IS_DATE_STRING', message: 'Bad date' },
          { field: 'value', code: 'IS_POSITIVE', message: 'Must be positive' },
        ],
      },
    })
    expect(getFieldErrors(error)).toEqual([
      { field: 'date_paid', code: 'IS_DATE_STRING', message: 'Bad date' },
      { field: 'value', code: 'IS_POSITIVE', message: 'Must be positive' },
    ])
  })

  // HOUSEHOLD_DELETION_PENDING puts an object here, not an array.
  it('is empty when details is an object rather than an array', () => {
    const error = axiosError(403, {
      error: { details: { deletion_scheduled_for: '2026-09-26' } },
    })
    expect(getFieldErrors(error)).toEqual([])
  })

  it('is empty when details is absent', () => {
    expect(getFieldErrors(axiosError(422, { error: { code: 'X' } }))).toEqual(
      [],
    )
  })

  it('drops rows that are not field errors rather than passing them through', () => {
    const error = axiosError(400, {
      error: {
        details: ['just a string', { field: 'name', message: 'Required' }],
      },
    })
    expect(getFieldErrors(error)).toEqual([
      { field: 'name', code: '', message: 'Required' },
    ])
  })
})

describe('getErrorMessage', () => {
  it('still prefers the enveloped message', () => {
    const error = axiosError(409, { error: { message: 'Already a member' } })
    expect(getErrorMessage(error)).toBe('Already a member')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/errors.test.ts`
Expected: FAIL — `getErrorCode`, `getErrorDetails` and `getFieldErrors` are not exported from `@/utils/errors`.

- [ ] **Step 3: Implement the readers**

In `src/utils/errors.ts`, add the `ApiFieldError` import and the readers below. Refactor `getErrorMessage` to use the new private `bodyOf` helper rather than repeating the cast.

```ts
import axios from 'axios'
import type { ApiErrorBody, ApiFieldError } from '@/types/api'

/** The response body, when there is one and it came from axios. */
const bodyOf = (error: unknown): ApiErrorBody | undefined =>
  axios.isAxiosError(error)
    ? (error.response?.data as ApiErrorBody | undefined)
    : undefined
```

Then rewrite `getErrorMessage`'s axios branch as `const body = bodyOf(error)` (its behaviour and doc comment are unchanged), and append:

```ts
/**
 * The machine-readable half of the envelope. Clients branch on this, never on
 * the status: several codes share one status, and `INVALID_TYPE`,
 * `INVALID_SOURCE` and `INVALID_USER` all arrive as 422.
 */
export const getErrorCode = (error: unknown): string | undefined =>
  bodyOf(error)?.error?.code

/**
 * The per-case payload, from wherever the server put it.
 *
 * The API nests it at `error.details`. The flat fallback is not hedging: the
 * mock and the shipped signin path both used the flat shape until this change,
 * and a stale deployment of either would otherwise open the deletion modal
 * with no date in it — a modal whose only content is the date.
 *
 * `undefined` rather than `null` when empty, because that is what the server
 * sends: in production `details` is published only for `VALIDATION_ERROR` and
 * `HOUSEHOLD_DELETION_PENDING`, and omitted everywhere else.
 */
export const getErrorDetails = (error: unknown): unknown => {
  const body = bodyOf(error)
  return body?.error?.details ?? body?.details
}

const asFieldError = (value: unknown): ApiFieldError | null => {
  if (typeof value !== 'object' || value === null) return null
  const row = value as Partial<ApiFieldError>
  if (typeof row.field !== 'string' || typeof row.message !== 'string') {
    return null
  }
  // `code` is documented but not load-bearing here — the field and the message
  // are what reach the form. Defaulting it beats dropping a real field error
  // over a missing validator name.
  return { field: row.field, code: row.code ?? '', message: row.message }
}

/**
 * The `details[]` of a `400 VALIDATION_ERROR`, one entry per failed constraint.
 *
 * Empty for every other error, including `HOUSEHOLD_DELETION_PENDING` — which
 * puts an *object* in the same slot. Callers get `[]` rather than a runtime
 * error for guessing wrong.
 */
export const getFieldErrors = (error: unknown): ApiFieldError[] => {
  const details = getErrorDetails(error)
  if (!Array.isArray(details)) return []
  return details.flatMap((row) => {
    const parsed = asFieldError(row)
    return parsed ? [parsed] : []
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/errors.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Type check and lint**

Run: `npm run type-check && npm run lint`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/utils/errors.ts src/utils/errors.test.ts
git commit -m "feat: read error code, details and field errors from the envelope"
```

---

### Task 2: Fix the `error.details` nesting (deviation #5)

**Files:**

- Modify: `src/modules/auth/signin/signin.ts:60-67`
- Modify: `src/mocks/handlers/auth.ts:33-48`
- Test: `src/modules/auth/signin/signin.test.ts` (existing — add cases)

**Interfaces:**

- Consumes: `getErrorDetails` from Task 1.
- Produces: nothing new. `deletionDeadlineFromResponse(error): string | null` keeps its signature.

This is the live bug: backend sends `error.details`, we read `data.details`, and the deletion modal opens blank.

- [ ] **Step 1: Write the failing test**

In `src/modules/auth/signin/signin.test.ts`, inside the existing
`describe('deletionDeadlineFromResponse')` block, add:

```ts
it('reads the deadline nested under error — the shape the API sends', () => {
  const error = axiosError(403, {
    error: {
      code: 'HOUSEHOLD_DELETION_PENDING',
      details: { deletion_scheduled_for: '2026-09-26' },
    },
  })
  expect(deletionDeadlineFromResponse(error)).toBe('2026-09-26')
})

it('is null when a 403 carries no details at all', () => {
  expect(
    deletionDeadlineFromResponse(axiosError(403, { error: { code: 'X' } })),
  ).toBeNull()
})
```

Leave the existing flat-shape test in place — the fallback keeps it passing, and it is now the regression test for that fallback.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/modules/auth/signin/signin.test.ts`
Expected: FAIL on "reads the deadline nested under error" — received `null`, expected `'2026-09-26'`.

- [ ] **Step 3: Use the shared reader**

Replace `deletionDeadlineFromResponse` in `src/modules/auth/signin/signin.ts` with:

```ts
/**
 * The 403 is not an inline error — it opens the deletion modal, and the modal
 * is useless without this date.
 */
export const deletionDeadlineFromResponse = (error: unknown): string | null => {
  if (statusOf(error) !== 403) return null
  const details = getErrorDetails(error) as
    { deletion_scheduled_for?: string } | undefined
  return details?.deletion_scheduled_for ?? null
}
```

Add `import { getErrorDetails } from '@/utils/errors'` to the imports. The
`axios` import is still needed by `statusOf`, so leave it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/modules/auth/signin/signin.test.ts`
Expected: PASS, including the pre-existing flat-shape case.

- [ ] **Step 5: Move the mock onto the real shape**

In `src/mocks/handlers/auth.ts`, replace the `email.includes('hapus')` branch (lines 33-48) with:

```ts
if (email.includes('hapus')) {
  // The only error carrying a `details` payload, so it cannot go through
  // `errorBody` — the modal is useless without the date. Nested inside
  // `error`, which is where the API puts it.
  return HttpResponse.json(
    {
      success: false,
      error: {
        code: 'HOUSEHOLD_DELETION_PENDING',
        message: 'This household is being deleted.',
        status_code: 403,
        details: { deletion_scheduled_for: '2026-09-26' },
      },
    },
    { status: 403 },
  )
}
```

Two changes beyond the nesting: the code becomes `HOUSEHOLD_DELETION_PENDING` (the documented code, not `FORBIDDEN`), and `status_code` moves inside `error` per deviation #4. Nothing reads `status_code`, so this is only about the mock telling the truth.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS. `SigninCard.test.tsx` exercises this handler; if it fails, the assertion is on the old shape and the test — not the handler — is what needs updating.

- [ ] **Step 7: Type check and lint**

Run: `npm run type-check && npm run lint`
Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add src/modules/auth/signin/signin.ts src/modules/auth/signin/signin.test.ts src/mocks/handlers/auth.ts
git commit -m "fix: read the deletion deadline from error.details, not the top level"
```

---

### Task 3: The expense error map

**Files:**

- Create: `src/modules/financial/lib/expenseErrors.ts`
- Test: `src/modules/financial/lib/expenseErrors.test.ts` (create)

**Interfaces:**

- Consumes: `getErrorCode`, `getErrorMessage`, `getFieldErrors` from Task 1; `CreateExpenseInput` from `@/types/expense`.
- Produces:
  - `type ExpenseField = keyof CreateExpenseInput`
  - `interface ExpenseFieldError { field: ExpenseField; message: string }`
  - `expenseFieldErrors(error: unknown): ExpenseFieldError[]`

Task 4 consumes `expenseFieldErrors`.

`src/modules/financial/lib/` does not exist yet. Create it — `src/modules/settings/lib/memberStatus.ts` is the precedent for a module-owned pure-logic directory.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/financial/lib/expenseErrors.test.ts`:

```ts
import { AxiosError } from 'axios'
import { expenseFieldErrors } from '@/modules/financial/lib/expenseErrors'

const axiosError = (status: number, data?: unknown): AxiosError => {
  const error = new AxiosError('Request failed', 'ERR_BAD_RESPONSE')
  error.response = { status, data } as AxiosError['response']
  return error
}

/** The 422 shape: a code, a message, and deliberately no `details[]`. */
const coded = (code: string, message: string) =>
  axiosError(422, { success: false, error: { code, message } })

describe('expenseFieldErrors', () => {
  it.each([
    ['INVALID_TYPE', 'typeId'],
    ['INVALID_SOURCE', 'sourceId'],
    ['INVALID_USER', 'paidByUserId'],
  ])('maps %s onto %s with the server wording', (code, field) => {
    expect(expenseFieldErrors(coded(code, 'Tidak ditemukan'))).toEqual([
      { field, message: 'Tidak ditemukan' },
    ])
  })

  it('maps every details[] row of a VALIDATION_ERROR', () => {
    const error = axiosError(400, {
      error: {
        code: 'VALIDATION_ERROR',
        details: [
          { field: 'date_paid', code: 'IS_DATE_STRING', message: 'Bad date' },
          { field: 'paid_by_user_id', code: 'IS_UUID', message: 'Bad user' },
        ],
      },
    })
    expect(expenseFieldErrors(error)).toEqual([
      { field: 'datePaid', message: 'Bad date' },
      { field: 'paidByUserId', message: 'Bad user' },
    ])
  })

  // An unmapped error must reach the summary line rather than vanish.
  it('is empty for a code it does not know', () => {
    expect(expenseFieldErrors(coded('SOMETHING_NEW', 'Nope'))).toEqual([])
  })

  it('skips a details[] row naming a field the form does not have', () => {
    const error = axiosError(400, {
      error: {
        details: [
          { field: 'household_id', code: 'WHITELIST', message: 'Not allowed' },
          { field: 'name', code: 'IS_NOT_EMPTY', message: 'Required' },
        ],
      },
    })
    expect(expenseFieldErrors(error)).toEqual([
      { field: 'name', message: 'Required' },
    ])
  })

  it('is empty for a network error with no response', () => {
    expect(expenseFieldErrors(new Error('offline'))).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/modules/financial/lib/expenseErrors.test.ts`
Expected: FAIL — cannot resolve `@/modules/financial/lib/expenseErrors`.

- [ ] **Step 3: Implement the map**

Create `src/modules/financial/lib/expenseErrors.ts`:

```ts
import { getErrorCode, getErrorMessage, getFieldErrors } from '@/utils/errors'
import type { CreateExpenseInput } from '@/types/expense'

/**
 * Turning a rejected create into errors the form can render on the field that
 * caused them.
 *
 * Two shapes reach here, because the API answers a bad reference differently
 * from a malformed body (BE `API-SPEC-DEVIATIONS.md` #1):
 *
 *   422 { error: { code: 'INVALID_TYPE', message } }        — no details[]
 *   400 { error: { code: 'VALIDATION_ERROR', details: [] } } — one row per field
 *
 * Anything unrecognised yields no entry, which is what routes it to the form's
 * summary line. Dropping it silently would be worse than a generic message.
 */
export type ExpenseField = keyof CreateExpenseInput

export interface ExpenseFieldError {
  field: ExpenseField
  message: string
}

/**
 * The 422 codes. There is no `details[]` on these, so the field comes from the
 * code — which is the entire reason this table exists.
 */
const FIELD_BY_CODE: Record<string, ExpenseField | undefined> = {
  INVALID_TYPE: 'typeId',
  INVALID_SOURCE: 'sourceId',
  INVALID_USER: 'paidByUserId',
}

/**
 * `details[].field` is the wire's name for the column. A lookup rather than a
 * snake→camel transform, for the reason `SORT_COLUMN` is one: a transform
 * happily "translates" `hosehold_id` into a field name and hands the form an
 * error it can never display.
 */
const FIELD_BY_WIRE_NAME: Record<string, ExpenseField | undefined> = {
  name: 'name',
  value: 'value',
  type_id: 'typeId',
  source_id: 'sourceId',
  date_paid: 'datePaid',
  paid_by_user_id: 'paidByUserId',
}

export const expenseFieldErrors = (error: unknown): ExpenseFieldError[] => {
  const rows = getFieldErrors(error)
  if (rows.length > 0) {
    return rows.flatMap((row) => {
      const field = FIELD_BY_WIRE_NAME[row.field]
      return field ? [{ field, message: row.message }] : []
    })
  }

  const field = FIELD_BY_CODE[getErrorCode(error) ?? '']
  return field ? [{ field, message: getErrorMessage(error) }] : []
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/modules/financial/lib/expenseErrors.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Type check and lint**

Run: `npm run type-check && npm run lint`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/modules/financial/lib/expenseErrors.ts src/modules/financial/lib/expenseErrors.test.ts
git commit -m "feat: map expense API error codes onto form fields"
```

---

### Task 4: Wire field errors into the expense form (deviation #1)

**Files:**

- Modify: `src/modules/financial/components/ExpenseForm.tsx`
- Modify: `src/mocks/handlers/expenses.ts` (the `POST` handler, ~line 165)
- Test: `src/modules/financial/components/ExpenseForm.test.tsx` (existing — add cases)

**Interfaces:**

- Consumes: `expenseFieldErrors`, `ExpenseField` from Task 3.
- Produces: nothing other tasks consume.

The mock needs to be able to answer 422 before the component test can drive it. Do the mock first, then the test, then the component.

- [ ] **Step 1: Teach the mock to reject bad references**

In `src/mocks/handlers/expenses.ts`, inside `http.post('*/api/v1/expenses', ...)`, after `const body = ...` and before `const created`, insert:

```ts
// Deviation #1: a bad reference is a 422 with a code and no `details[]`,
// not a 400 with a field list. Checked against the live rows so an
// archived category or a tombstoned member is rejected on create.
if (body.type_id && !db.categories.some((row) => row.id === body.type_id)) {
  return errorBody(422, 'INVALID_TYPE', 'Kategori tidak ditemukan')
}
if (body.source_id && !db.accounts.some((row) => row.id === body.source_id)) {
  return errorBody(422, 'INVALID_SOURCE', 'Metode pembayaran tidak ditemukan')
}
if (
  body.paid_by_user_id &&
  !db.members.some((row) => row.id === body.paid_by_user_id)
) {
  return errorBody(422, 'INVALID_USER', 'Anggota tidak ditemukan')
}
```

`errorBody` is already imported in this file (line 7), and `db.categories`, `db.accounts` and `db.members` are the real collection names (`src/mocks/db.ts:34-40`).

- [ ] **Step 2: Write the failing component tests**

In `src/modules/financial/components/ExpenseForm.test.tsx`, add `server` and the MSW helpers to the imports:

```ts
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
```

(`src/test/setup.ts:10` imports `server` from this path, so the override lands on the same instance, and `setup.ts:15` calls `server.resetHandlers()` between tests.)

Then add these cases:

```ts
  /** A 422 with a code and no details[] — the shape deviation #1 describes. */
  const rejectWith = (code: string, message: string) => {
    server.use(
      http.post('*/api/v1/expenses', () =>
        HttpResponse.json(
          { success: false, error: { code, message, status_code: 422 } },
          { status: 422 },
        ),
      ),
    )
  }

  const fillValidForm = async () => {
    await userEvent.type(screen.getByLabelText(/nama pengeluaran/i), 'Kopi')
    await userEvent.type(screen.getByLabelText(/jumlah/i), '25000')
    await chooseOption(/kategori/i, 'Belanja')
    await chooseOption(/metode pembayaran/i, /^Tunai/)
  }

  it('puts a rejected category on the category field, not in a generic toast', async () => {
    rejectWith('INVALID_TYPE', 'Kategori tidak ditemukan')
    renderWithProviders(<ExpenseForm />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: /catat/i }))

    expect(
      await screen.findByText('Kategori tidak ditemukan'),
    ).toBeInTheDocument()
    // Once, not twice: the summary line stands down when a field claimed it.
    expect(screen.getAllByText('Kategori tidak ditemukan')).toHaveLength(1)
  })

  it('puts a rejected payment method on the method field', async () => {
    rejectWith('INVALID_SOURCE', 'Metode pembayaran tidak ditemukan')
    renderWithProviders(<ExpenseForm />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: /catat/i }))

    expect(
      await screen.findByText('Metode pembayaran tidak ditemukan'),
    ).toBeInTheDocument()
  })

  it('puts a rejected payer on the paid-by field', async () => {
    rejectWith('INVALID_USER', 'Anggota tidak ditemukan')
    renderWithProviders(<ExpenseForm />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: /catat/i }))

    expect(await screen.findByText('Anggota tidak ditemukan')).toBeInTheDocument()
  })

  it('clears a server field error when the member changes that field', async () => {
    rejectWith('INVALID_TYPE', 'Kategori tidak ditemukan')
    renderWithProviders(<ExpenseForm />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: /catat/i }))
    await screen.findByText('Kategori tidak ditemukan')

    await chooseOption(/kategori/i, 'Transport')

    await waitFor(() =>
      expect(
        screen.queryByText('Kategori tidak ditemukan'),
      ).not.toBeInTheDocument(),
    )
  })

  // An error nothing can be pinned on must still be visible.
  it('falls back to the summary line for an unmapped error', async () => {
    rejectWith('RATE_LIMITED', 'Terlalu banyak permintaan')
    renderWithProviders(<ExpenseForm />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: /catat/i }))

    expect(
      await screen.findByText('Terlalu banyak permintaan'),
    ).toBeInTheDocument()
  })
```

`'Belanja'` and `'Transport'` are two of the four seeded category names (`src/mocks/fixtures/categories.ts:4`), both unarchived, so both appear in the picker.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/modules/financial/components/ExpenseForm.test.tsx`
Expected: FAIL — the messages render once in the summary line, so the category test fails on the field lookup or on the "exactly once" assertion, and the clear-on-edit test fails because nothing clears.

- [ ] **Step 4: Apply field errors in the form**

In `src/modules/financial/components/ExpenseForm.tsx`:

Add the import:

```ts
import { expenseFieldErrors } from '@/modules/financial/lib/expenseErrors'
import type { ExpenseField } from '@/modules/financial/lib/expenseErrors'
```

Pull `setError` and `clearErrors` out of `useForm`:

```ts
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<CreateExpenseInput>({
```

Add a state flag next to the hook calls, above `onSubmit`:

```ts
// Whether the last failure landed on a field. The summary line stands down
// when it did — a field error plus a summary says the same thing twice.
const [handledOnField, setHandledOnField] = useState(false)
```

`ExpenseForm.tsx` has no React import today, so add `import { useState } from 'react'` as a new first import line.

Replace `onSubmit` with:

```ts
const onSubmit = (data: CreateExpenseInput) => {
  createExpense(
    { ...data, value: Number(data.value) },
    {
      onSuccess: () => {
        setHandledOnField(false)
        reset()
        onSuccess?.()
      },
      onError: (failure) => {
        const fieldErrors = expenseFieldErrors(failure)
        fieldErrors.forEach(({ field, message }) => {
          setError(field, { type: 'server', message })
        })
        setHandledOnField(fieldErrors.length > 0)
      },
    },
  )
}

/**
 * A server field error survives until the member acts on it. RHF does not
 * clear a `setError` error on change under the default `onSubmit` mode, so
 * each Select clears its own — otherwise a rejected category stays marked
 * after being corrected.
 */
const changeAndClear =
  (field: ExpenseField, onChange: (value: string) => void) =>
  (value: string) => {
    clearErrors(field)
    setHandledOnField(false)
    onChange(value)
  }
```

Change each of the three `Controller` Selects' `onChange` from `field.onChange` to the wrapped form — for the category Select:

```tsx
            onChange={changeAndClear('typeId', field.onChange)}
```

and correspondingly `'sourceId'` and `'paidByUserId'` for the other two.

Finally, change the summary line's condition:

```tsx
      {error && !handledOnField && (
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/modules/financial/components/ExpenseForm.test.tsx`
Expected: PASS, including the five pre-existing cases.

- [ ] **Step 6: Run the full suite, type check and lint**

Run: `npm test && npm run type-check && npm run lint`
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add src/modules/financial/components/ExpenseForm.tsx src/modules/financial/components/ExpenseForm.test.tsx src/mocks/handlers/expenses.ts
git commit -m "feat: land rejected references on the expense form field that caused them"
```

---

### Task 5: Split `AccountKind` into wire and domain (deviation #2)

**Files:**

- Modify: `src/types/catalog.ts:21` and the `WireAccount` interface
- Modify: `src/modules/settings/api/accounts.ts`
- Modify: `src/mocks/handlers/accounts.ts`
- Test: `src/modules/settings/api/accounts.test.ts` (create — there is no accounts api test today)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:
  - `type WireAccountKind = 'CASH' | 'BANK' | 'EWALLET'` in `@/types/catalog`
  - `AccountKind` unchanged: `'cash' | 'bank' | 'ewallet'`
  - `toAccount(row: WireAccount): Account` — signature unchanged, behaviour now maps `kind`

`AccountSection.tsx` and `mocks/fixtures/accounts.ts` are **not** touched: the fixture is typed `Account[]`, the domain type, and the handler converts.

**The cutover risk, from spec §6:** between this shipping and backend shipping uppercase, `toAccount` receives lowercase. The mapping must fall back to its input rather than to `undefined` — an account whose `kind` is `undefined` renders an unselected radio group in Settings. The test below pins that.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/settings/api/accounts.test.ts`:

```ts
import { toAccount } from '@/modules/settings/api/accounts'
import type { WireAccount } from '@/types/catalog'

const wire = (kind: string): WireAccount =>
  ({
    id: 'source-tunai',
    name: 'Tunai',
    kind,
    opening_balance: 1500000,
    as_of: '2026-05-01',
    order: 0,
    archived_at: null,
    household_id: 'household-001',
  }) as WireAccount

describe('toAccount', () => {
  it.each([
    ['CASH', 'cash'],
    ['BANK', 'bank'],
    ['EWALLET', 'ewallet'],
  ])('maps the wire %s onto the domain %s', (sent, expected) => {
    expect(toAccount(wire(sent)).kind).toBe(expected)
  })

  // The cutover: until the API ships uppercase it still sends lowercase, and
  // an undefined `kind` renders an unselected radio group in Settings.
  it.each(['cash', 'bank', 'ewallet'])(
    'passes a lowercase %s through during the cutover',
    (sent) => {
      expect(toAccount(wire(sent)).kind).toBe(sent)
    },
  )

  it('leaves the rest of the row alone', () => {
    expect(toAccount(wire('CASH'))).toEqual({
      id: 'source-tunai',
      name: 'Tunai',
      kind: 'cash',
      openingBalance: 1500000,
      asOf: '2026-05-01',
      order: 0,
      archivedAt: null,
      householdId: 'household-001',
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/modules/settings/api/accounts.test.ts`
Expected: FAIL on the three uppercase cases — `toAccount` passes `'CASH'` straight through.

- [ ] **Step 3: Split the type**

In `src/types/catalog.ts`, replace the `AccountKind` line with:

```ts
/**
 * What the API sends. Uppercase, matching `role` and `household_status` —
 * BE `API-SPEC-DEVIATIONS.md` #2 settles the open decision in §6.5 of the
 * FE spec, which had assumed lowercase.
 */
export type WireAccountKind = 'CASH' | 'BANK' | 'EWALLET'

/**
 * What the app uses. Lowercase, like every other domain enum here, and what
 * the Settings radio group binds to — which is why this is a mapping and not
 * a rename.
 */
export type AccountKind = 'cash' | 'bank' | 'ewallet'
```

and in the `WireAccount` interface change `kind: AccountKind` to `kind: WireAccountKind`.

- [ ] **Step 4: Map both directions**

In `src/modules/settings/api/accounts.ts`, add `WireAccountKind` to the type import and insert above `toAccount`:

```ts
/**
 * `kind` is the one field whose casing differs across the wire. Two records
 * rather than `toLowerCase()`, for the reason `SORT_COLUMN` is a record: a
 * cast would let a value the union does not contain reach the radio group,
 * which then renders with nothing selected and no error anywhere.
 *
 * Inbound falls back to its input: until the API ships uppercase it still sends
 * lowercase, and a `kind` of `undefined` is exactly that unselected group.
 * Outbound needs no fallback — the domain union is closed.
 */
const KIND_FROM_WIRE: Record<string, AccountKind | undefined> = {
  CASH: 'cash',
  BANK: 'bank',
  EWALLET: 'ewallet',
}

/**
 * Outbound is total — `AccountKind` is a closed union and every member is
 * listed, so this needs no fallback and the compiler enforces that.
 */
const KIND_TO_WIRE: Record<AccountKind, WireAccountKind> = {
  cash: 'CASH',
  bank: 'BANK',
  ewallet: 'EWALLET',
}

const toDomainKind = (kind: string): AccountKind =>
  KIND_FROM_WIRE[kind] ?? (kind as AccountKind)

const toWireKind = (kind: AccountKind): WireAccountKind => KIND_TO_WIRE[kind]
```

Add `AccountKind` and `WireAccountKind` to the existing `import type { Account, WireAccount } from '@/types/catalog'`.

In `toAccount`, change `kind: row.kind` to `kind: toDomainKind(row.kind)`.

In `toAccountBody`, change the `kind` line to:

```ts
if (patch.kind !== undefined) body.kind = toWireKind(patch.kind)
```

In `useCreateAccount`'s post body, change `kind: input.kind` to `kind: toWireKind(input.kind)`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/modules/settings/api/accounts.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Move the mock onto the uppercase wire**

In `src/mocks/handlers/accounts.ts`:

Add near the top, below the imports:

```ts
/** The mock's store holds domain rows; only the wire is uppercase. */
const KIND_TO_WIRE: Record<AccountKind, WireAccountKind> = {
  cash: 'CASH',
  bank: 'BANK',
  ewallet: 'EWALLET',
}

const KIND_FROM_WIRE: Record<string, AccountKind | undefined> = {
  CASH: 'cash',
  BANK: 'bank',
  EWALLET: 'ewallet',
}
```

In `toWire`, change `kind: account.kind` to `kind: KIND_TO_WIRE[account.kind]`.

In the `POST` handler, change the `kind` line to:

```ts
      kind: KIND_FROM_WIRE[body.kind ?? 'CASH'] ?? 'cash',
```

In the `PATCH` handler, change the `kind` spread to:

```ts
      ...(body.kind !== undefined && {
        kind: KIND_FROM_WIRE[body.kind] ?? 'cash',
      }),
```

Update the type import to `import type { Account, AccountKind, WireAccount, WireAccountKind } from '@/types/catalog'`.

- [ ] **Step 7: Run the full suite, type check and lint**

Run: `npm test && npm run type-check && npm run lint`
Expected: all clean. `src/modules/settings/api/categories.test.tsx` and any `AccountSection` test exercise this path end to end through MSW.

- [ ] **Step 8: Commit**

```bash
git add src/types/catalog.ts src/modules/settings/api/accounts.ts src/modules/settings/api/accounts.test.ts src/mocks/handlers/accounts.ts
git commit -m "feat: map PaymentSource kind between the uppercase wire and the lowercase domain"
```

---

### Task 6: The invite 403 and resend 409s (deviation #3)

**Files:**

- Modify: `src/modules/settings/components/MemberSection.tsx:136-142`
- Modify: `src/mocks/handlers/members.ts`
- Modify: `messages/en.json`, `messages/id.json`
- Test: `src/modules/settings/components/MemberSection.test.tsx` (existing — it already has a `setup()` helper and drives this exact form)

**Interfaces:**

- Consumes: `getErrorDetails` from Task 1; `formatDate` from `@/utils/formatters`; `useSettings().locale`.
- Produces: nothing other tasks consume.

The invite form is already hidden when `householdActive` is false, so this 403 is a race — a member with Settings open when deletion starts. The message renders verbatim as it does today; only the date is appended.

- [ ] **Step 1: Add the i18n key**

In `messages/en.json`, beside the other `mem_` keys:

```json
  "mem_invite_deletion_deadline": "This household is scheduled for deletion on {date}.",
```

In `messages/id.json`:

```json
  "mem_invite_deletion_deadline": "Rumah tangga ini dijadwalkan dihapus pada {date}.",
```

- [ ] **Step 2: Write the failing test**

Add to `src/modules/settings/components/MemberSection.test.tsx`. It already has a
`setup()` helper (lines 6-15) and renders with the `id` locale, so only the MSW
imports are new:

```ts
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
```

```ts
it('names the deletion date when an invite is refused for a pending deletion', async () => {
  server.use(
    http.post('*/api/v1/households/:id/members', () =>
      HttpResponse.json(
        {
          success: false,
          error: {
            code: 'HOUSEHOLD_DELETION_PENDING',
            message: 'Rumah tangga ini sedang dihapus.',
            status_code: 403,
            details: { deletion_scheduled_for: '2026-09-26' },
          },
        },
        { status: 403 },
      ),
    ),
  )
  setup()
  await screen.findByText('Sari')

  await userEvent.type(screen.getByLabelText(/nama/i), 'Baru')
  await userEvent.type(screen.getByLabelText(/email/i), 'baru@example.com')
  await userEvent.click(screen.getByRole('button', { name: /kirim undangan/i }))

  // The server's wording verbatim, plus the date it does not carry.
  // `formatDate` at `id-ID` with month: 'short' renders "26 Sep 2026".
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Rumah tangga ini sedang dihapus.')
  expect(alert).toHaveTextContent('26 Sep 2026')
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/modules/settings/components/MemberSection.test.tsx`
Expected: FAIL — the message renders, the date does not.

- [ ] **Step 4: Append the date**

In `src/modules/settings/components/MemberSection.tsx`, add the imports:

```ts
import { getErrorDetails, getErrorMessage } from '@/utils/errors'
import { useSettings } from '@/contexts/useSettings'
import { formatDate } from '@/utils/formatters'
```

(`getErrorMessage` is already imported — extend that line rather than duplicating it.)

Add beside the other hook calls:

```ts
const { locale } = useSettings()
```

Add above the `return`:

```ts
/**
 * `HOUSEHOLD_DELETION_PENDING` is one of two errors that carry `details`
 * (BE #5). The message is rendered verbatim as every invite error is; the
 * date is the part it does not contain, and the part that tells a member
 * whether waiting is an option.
 */
const inviteDeadline = (
  getErrorDetails(inviteError) as
    { deletion_scheduled_for?: string } | undefined
)?.deletion_scheduled_for
```

Replace the `inviteError` block (lines ~136-142) with:

```tsx
{
  inviteError && (
    // 409 wording differs per case and is shown verbatim — the copy is
    // the feature, so it is never replaced with a generic message.
    <p role="alert" className="text-danger mt-2 text-[11px]">
      {getErrorMessage(inviteError)}
      {inviteDeadline && (
        <>
          {' '}
          {m.mem_invite_deletion_deadline({
            date: formatDate(inviteDeadline, locale),
          })}
        </>
      )}
    </p>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/modules/settings/components/MemberSection.test.tsx`
Expected: PASS.

- [ ] **Step 6: Split the resend 409 per case**

**The 409 itself already exists** — `src/mocks/handlers/members.ts:120-126` answers
`409 CONFLICT` for both a tombstoned member and an accepted invite. Deviation #3
is satisfied by the status alone, so this step is a copy improvement, not a
behaviour change: the two cases share one message, and §5.7 of the API spec is
explicit that per-case wording is the feature.

Replace lines 120-126 with:

```ts
// Two different 409s, deliberately worded apart: "they are gone" and
// "they are already in" call for different next actions, and this copy
// is rendered verbatim.
if (member.deletedAt) {
  return errorBody(
    409,
    'CONFLICT',
    'Anggota ini sudah tidak ada di rumah tangga.',
  )
}
if (!member.inviteExpiresAt) {
  return errorBody(
    409,
    'CONFLICT',
    'Undangan ini sudah diterima — tidak perlu dikirim ulang.',
  )
}
```

`errorBody` is already imported (line 11). No component change: `MemberSection`
renders `resendError` verbatim through `actionError` (line 78).

- [ ] **Step 7: Run the full suite, type check and lint**

Run: `npm test && npm run type-check && npm run lint`
Expected: all clean. Any existing test asserting the old single resend message needs its expected string updated to whichever of the two cases it drives.

- [ ] **Step 8: Commit**

```bash
git add src/modules/settings/components/MemberSection.tsx src/modules/settings/components/MemberSection.test.tsx src/mocks/handlers/members.ts messages/en.json messages/id.json
git commit -m "feat: name the deletion date on a refused invite, and reject stale resends"
```

---

### Task 7: Remove the dead decimal money constants (deviation #6)

**Files:**

- Modify: `src/utils/money.ts`
- Modify: `src/utils/money.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `src/utils/money.ts` exports only `roundMoney` and `sumMoney` after this.

`MONEY_MAX = 99_999_999.99` is the ceiling deviation #6 says can be dropped. It is not enforced anywhere — the expense form has `min: 1` and no maximum — and the whole file documents a `DECIMAL(10,2)` convention that `docs/API-SPEC-EXPENSE.md` §3.2 replaced with integer minor units. Only `sumMoney` is imported (`ExpensesPage.tsx:20`).

- [ ] **Step 1: Confirm nothing else imports the removals**

Run:

```bash
grep -rn "MONEY_MAX\|MONEY_MIN\|MONEY_STEP\|MONEY_DECIMALS\|isValidMoney\|averageMoney" src
```

Expected: hits only in `src/utils/money.ts` and `src/utils/money.test.ts`. **If anything else appears, stop and report it** — the removal is only safe because these are dead.

- [ ] **Step 2: Remove them**

In `src/utils/money.ts`, delete `MONEY_MAX`, `MONEY_MIN`, `MONEY_DECIMALS`, `MONEY_STEP`, `isValidMoney` and `averageMoney`, and replace the file header comment with:

```ts
/**
 * Money is an integer in minor units on the wire (`API-SPEC-EXPENSE.md`
 * §3.2) — for IDR the minor unit is the rupiah itself, so `87000` is Rp 87.000.
 *
 * Summing is still routed through here rather than done inline. The values are
 * integers, but a total is a claim about the household's money, and having one
 * function own it means a currency whose minor unit is not the major one can
 * be handled in a single place rather than at every call site.
 *
 * There is no ceiling here any more: the column caps at 999,999,999,999.99
 * (BE `API-SPEC-DEVIATIONS.md` #6), far above anything a client should be
 * refusing on the server's behalf.
 */
```

Keep `roundMoney` — `sumMoney` depends on it — but update its doc comment's opening line to note it exists for `sumMoney`'s benefit rather than for a two-decimal column.

- [ ] **Step 3: Trim the tests**

In `src/utils/money.test.ts`, delete the `isValidMoney` and `averageMoney` describes and the `MONEY_MAX` import. Keep every `roundMoney` and `sumMoney` case.

- [ ] **Step 4: Run the tests, type check and lint**

Run: `npm test && npm run type-check && npm run lint`
Expected: all clean.

- [ ] **Step 5: Commit**

```bash
git add src/utils/money.ts src/utils/money.test.ts
git commit -m "refactor: drop the decimal-era money constants the integer wire made dead"
```

---

## Verification

After Task 7, confirm the whole branch:

- [ ] `npm test` — full suite passes
- [ ] `npm run type-check` — clean
- [ ] `npm run lint` — clean
- [ ] `npm run build` — succeeds
- [ ] `grep -rn "data.details" src` returns nothing outside `utils/errors.ts`
- [ ] `grep -rn "kind: row.kind\|kind: account.kind" src` returns nothing — every `kind` hop is mapped

## Not in this plan

- **Deviation #7** (`date_paid` through tomorrow UTC). Deliberately not relaxed — see spec §3. `max={today}` stays.
- **Deviation #4** (`error.status_code` nesting) and **#8** (`deleted_at` full ISO). Nothing reads either; no change.
- **The app-auth half of #3.** The member status union is already current on this side; if app-auth calls the member routes, that cutover is coordinated outside this branch.
