import { http } from 'msw'
import { db, nextId } from '@/mocks/db'
import { MOCK_HOUSEHOLD, MOCK_USER } from '@/mocks/fixtures/household'
import {
  READ_LATENCY_MS,
  WRITE_LATENCY_MS,
  errorBody,
  notFound,
  ok,
  okPage,
  pause,
  previousPeriod,
} from '@/mocks/handlers/shared'
import type { WireMeta } from '@/mocks/handlers/shared'
import { averageMoney, isValidMoney, sumMoney } from '@/utils/money'
import type { StoredExpense, WireExpense } from '@/types/expense'

/**
 * Domain → wire. The store keeps camelCase rows because the fixtures and the
 * app's own types are camelCase; the boundary is here, so the mock answers in
 * exactly the casing the API document specifies.
 */
const toWire = (expense: StoredExpense): WireExpense => ({
  id: expense.id,
  name: expense.name,
  description: expense.description ?? null,
  value: expense.value,
  type_id: expense.typeId,
  source_id: expense.sourceId,
  date_paid: expense.datePaid,
  paid_by_user_id: expense.paidByUserId,
  household_id: expense.householdId,
  created_by_user_id: expense.createdByUserId,
  updated_by_admin_id: expense.updatedByAdminId,
  created_at: expense.createdAt,
  updated_at: expense.updatedAt,
})

/**
 * Soft delete, per the PRD: a removed row keeps its `deleted_at` and stays in
 * the store for the 7-day recovery window, but never reaches a response.
 * Every read starts here, so a route cannot forget the filter.
 */
const live = (): StoredExpense[] =>
  db.expenses.filter((expense) => expense.deletedAt === null)

const totalsFor = (items: StoredExpense[]) => {
  const sum = sumMoney(items.map((expense) => expense.value))
  return { sum, count: items.length, average: averageMoney(sum, items.length) }
}

/** Ranked `sum DESC, count DESC, id ASC`, capped at 5, as the API ranks it. */
const rank = (
  items: StoredExpense[],
  keyOf: (row: StoredExpense) => string,
) => {
  const byKey = new Map<string, { sum: number; count: number }>()
  items.forEach((row) => {
    const key = keyOf(row)
    const bucket = byKey.get(key) ?? { sum: 0, count: 0 }
    byKey.set(key, { sum: bucket.sum + row.value, count: bucket.count + 1 })
  })
  return [...byKey.entries()]
    .map(([id, bucket]) => ({
      id,
      sum: sumMoney([bucket.sum]),
      count: bucket.count,
    }))
    .sort(
      (a, b) => b.sum - a.sum || b.count - a.count || a.id.localeCompare(b.id),
    )
    .slice(0, 5)
}

/**
 * The counts, hoisted into `meta` where the envelope puts them.
 *
 * Every block is computed over `items` — the whole filtered set — before the
 * page is sliced out of it, which is the property everything rendering from
 * them depends on. Computing them after the slice would make them
 * page-scoped, and a count strip that changes when you turn the page is
 * reporting nothing.
 *
 * `summary` supersedes `totals`; both are sent while `totals` is deprecated,
 * and `summary.current` is the same aggregate so the two cannot disagree.
 * `previous` is omitted rather than zeroed when no period resolves — absent
 * means "not computed", and a `0` is a claim about the household's money.
 */
const metaFor = (
  items: StoredExpense[],
  page: number,
  limit: number,
  previous: StoredExpense[] | null,
): WireMeta => {
  const current = totalsFor(items)
  return {
    pagination: {
      page,
      limit,
      total: items.length,
      total_pages: Math.max(1, Math.ceil(items.length / limit)),
    },
    totals: current,
    summary: {
      current,
      ...(previous ? { previous: totalsFor(previous) } : {}),
      // Always present, `[]` included: "nothing matched" is an answer.
      breakdown: {
        by_type: rank(items, (row) => row.typeId),
        by_member: rank(items, (row) => row.paidByUserId),
      },
    },
  }
}

/**
 * Sort reads the API's own parameter names and column names — `sort_by`,
 * `sort_order`, `date_paid`. It previously read `order`, which is the *browser
 * URL* name, so `sortOrder=asc` was silently ignored and the mock always
 * answered descending. A sort control built against that would have looked
 * correct and done nothing.
 */
const compare = (
  a: StoredExpense,
  b: StoredExpense,
  sortBy: string,
): number => {
  if (sortBy === 'value') return a.value - b.value
  if (sortBy === 'name') return a.name.localeCompare(b.name)
  return a.datePaid.localeCompare(b.datePaid)
}

const SORT_COLUMNS = ['date_paid', 'value', 'name']

/** The tape asks for a whole month at once, so this is 500 and not 100. */
const MAX_LIMIT = 500

/**
 * What a *new* row may point at. An existing row may reference an archived
 * category or a tombstoned payer; new spending may not. 422, no `details[]`.
 */
const REF_CHECKS = [
  {
    key: 'type_id' as const,
    code: 'INVALID_TYPE',
    message: 'Kategori tidak tersedia',
    live: (id: string) =>
      db.categories.some((row) => row.id === id && row.archivedAt === null),
  },
  {
    key: 'source_id' as const,
    code: 'INVALID_SOURCE',
    message: 'Metode pembayaran tidak tersedia',
    live: (id: string) =>
      db.accounts.some((row) => row.id === id && row.archivedAt === null),
  },
  {
    key: 'paid_by_user_id' as const,
    code: 'INVALID_USER',
    message: 'Anggota tidak tersedia',
    live: (id: string) =>
      db.members.some((row) => row.id === id && !row.deletedAt),
  },
]

/**
 * Only the refs the body carries — re-checking one it never named would make
 * rows with an archived category uneditable.
 */
const badRef = (body: Partial<WireExpense>) => {
  for (const check of REF_CHECKS) {
    const id = body[check.key]
    if (id !== undefined && !check.live(id)) {
      return errorBody(422, check.code, check.message)
    }
  }
  return null
}

/** Tomorrow, not today: Jakarta is UTC+7, so local today can be UTC yesterday. */
const tomorrowUtc = (): string =>
  new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

/** The server's own order: whitelist first, then field constraints. */
const badBody = (body: Partial<WireExpense> & Record<string, unknown>) => {
  if ('household_id' in body) {
    return errorBody(400, 'VALIDATION_ERROR', 'Validation failed', [
      {
        field: 'household_id',
        code: 'WHITELIST',
        message: 'property household_id should not exist',
      },
    ])
  }
  if (body.value !== undefined && !isValidMoney(body.value)) {
    return errorBody(400, 'VALIDATION_ERROR', 'Validation failed', [
      {
        field: 'value',
        code: 'IS_DECIMAL',
        message: 'value must be positive with at most 2 decimal places',
      },
    ])
  }
  if (body.date_paid !== undefined && body.date_paid > tomorrowUtc()) {
    return errorBody(400, 'FUTURE_DATE', 'date_paid cannot be in the future')
  }
  return null
}

export const expenseHandlers = [
  http.get('*/api/v1/expenses', async ({ request }) => {
    await pause(READ_LATENCY_MS)
    const params = new URL(request.url).searchParams
    const page = Number(params.get('page') ?? '1')
    const limit = Number(params.get('limit') ?? '25')
    const search = (params.get('search') ?? '').trim().toLowerCase()
    const sortBy = params.get('sort_by') ?? 'date_paid'
    // Case-sensitive on purpose: `ASC` is the documented value, and quietly
    // accepting `asc` here would hide a client that never sends the real one.
    const ascending = params.get('sort_order') === 'ASC'

    // A rejected sort column is the whole reason the parameter is validated
    // server-side: silently falling back to the default is how a broken
    // control keeps looking like a working one.
    if (!SORT_COLUMNS.includes(sortBy)) {
      return errorBody(
        400,
        'VALIDATION_ERROR',
        `sort_by must be one of: ${SORT_COLUMNS.join(', ')}`,
      )
    }
    // The ceiling is 500 rather than the usual 100 because the tape is
    // continuous: it asks for a whole month in one request. Enforced here so
    // the limit in the spec is a limit and not a suggestion.
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return errorBody(
        400,
        'VALIDATION_ERROR',
        `limit must be an integer between 1 and ${MAX_LIMIT}`,
      )
    }
    if (!Number.isInteger(page) || page < 1) {
      return errorBody(400, 'VALIDATION_ERROR', 'page must be an integer ≥ 1')
    }

    // Every filter but the period, so `previous` can reuse it with a
    // different window — the same reason the API shares one `where` builder.
    const matchesExceptPeriod = (expense: StoredExpense) => {
      const typeId = params.get('type_id')
      const sourceId = params.get('source_id')
      const paidBy = params.get('paid_by_user_id')
      if (typeId && expense.typeId !== typeId) return false
      if (sourceId && expense.sourceId !== sourceId) return false
      if (paidBy && expense.paidByUserId !== paidBy) return false
      if (search && !expense.name.toLowerCase().includes(search)) return false
      return true
    }
    const within = (expense: StoredExpense, from: string, to: string) =>
      (!from || expense.datePaid >= from) && (!to || expense.datePaid <= to)

    const from = params.get('date_from') ?? ''
    const to = params.get('date_to') ?? ''
    const items = live()
      .filter(
        (expense) => matchesExceptPeriod(expense) && within(expense, from, to),
      )
      .sort((a, b) =>
        ascending ? compare(a, b, sortBy) : compare(b, a, sortBy),
      )

    const back = previousPeriod(params.get('date_from'), params.get('date_to'))
    const previous = back
      ? live().filter(
          (expense) =>
            matchesExceptPeriod(expense) && within(expense, back.from, back.to),
        )
      : null

    const start = (page - 1) * limit
    return okPage(
      items.slice(start, start + limit).map(toWire),
      metaFor(items, page, limit, previous),
    )
  }),

  http.get('*/api/v1/expenses/:id', async ({ params }) => {
    await pause(READ_LATENCY_MS)
    const expense = live().find((row) => row.id === params.id)
    return expense ? ok(toWire(expense)) : notFound('Expense')
  }),

  http.post('*/api/v1/expenses', async ({ request }) => {
    await pause(WRITE_LATENCY_MS)
    const body = (await request.json()) as Partial<WireExpense> &
      Record<string, unknown>
    // Deviation #1: a bad ref is a 422 with a code, not a 400 with a field list.
    const rejected = badBody(body) ?? badRef(body)
    if (rejected) return rejected
    const created: StoredExpense = {
      id: nextId('exp'),
      name: body.name ?? '',
      // Blank is coerced to null on write, so `''` never reaches the store
      // and a reader never has to treat the two as the same thing.
      description: body.description?.trim() || null,
      value: body.value ?? 0,
      typeId: body.type_id ?? '',
      sourceId: body.source_id ?? '',
      datePaid: body.date_paid ?? '',
      paidByUserId: body.paid_by_user_id ?? '',
      householdId: MOCK_HOUSEHOLD.id,
      createdByUserId: MOCK_USER.id,
      createdAt: new Date().toISOString(),
      updatedByAdminId: null,
      updatedAt: null,
      deletedAt: null,
    }
    db.expenses.unshift(created)
    return ok(toWire(created), { status: 201 })
  }),

  http.patch('*/api/v1/expenses/:id', async ({ params, request }) => {
    await pause(WRITE_LATENCY_MS)
    const body = (await request.json()) as Partial<WireExpense> &
      Record<string, unknown>
    // `description` is the one nullable column on the ledger, and `null` is
    // how it is cleared. Every other field is non-nullable: absent leaves it
    // alone, null is a 400.
    const nulled = Object.keys(body).find(
      (key) => body[key] === null && key !== 'description',
    )
    if (nulled) {
      return errorBody(400, 'VALIDATION_ERROR', 'Validation failed', [
        {
          field: nulled,
          code: 'IS_NOT_NULL',
          message: `${nulled} cannot be null`,
        },
      ])
    }
    const rejected = badBody(body) ?? badRef(body)
    if (rejected) return rejected
    const index = db.expenses.findIndex(
      (expense) => expense.id === params.id && expense.deletedAt === null,
    )
    if (index === -1) return notFound('Expense')
    const current = db.expenses[index]
    db.expenses[index] = {
      ...current,
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && {
        description: body.description?.trim() || null,
      }),
      ...(body.value !== undefined && { value: body.value }),
      ...(body.type_id !== undefined && { typeId: body.type_id }),
      ...(body.source_id !== undefined && { sourceId: body.source_id }),
      ...(body.date_paid !== undefined && { datePaid: body.date_paid }),
      ...(body.paid_by_user_id !== undefined && {
        paidByUserId: body.paid_by_user_id,
      }),
      // Who last changed it, tracked apart from who recorded it — only an
      // admin can reach this route, so they are different questions.
      updatedByAdminId: MOCK_USER.id,
      updatedAt: new Date().toISOString(),
    }
    return ok(toWire(db.expenses[index]))
  }),

  http.delete('*/api/v1/expenses/:id', async ({ params }) => {
    await pause(WRITE_LATENCY_MS)
    const expense = db.expenses.find(
      (row) => row.id === params.id && row.deletedAt === null,
    )
    if (!expense) return notFound('Expense')
    // Soft delete: the row is tombstoned, not dropped. It leaves every
    // response immediately and stays in the store for the recovery window.
    expense.deletedAt = new Date().toISOString()
    // Enveloped rather than 204: the FE's response interceptor is the same one
    // for every route, and a body-less success is a second contract to carry.
    return ok(null, { message: 'Expense deleted' })
  }),
]
