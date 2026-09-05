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
} from '@/mocks/handlers/shared'
import type { WireMeta } from '@/mocks/handlers/shared'
import type { StoredExpense, WireExpense } from '@/types/expense'

/**
 * Domain → wire. The store keeps camelCase rows because the fixtures and the
 * app's own types are camelCase; the boundary is here, so the mock answers in
 * exactly the casing the API document specifies.
 */
const toWire = (expense: StoredExpense): WireExpense => ({
  id: expense.id,
  name: expense.name,
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
 * the store for the 30-day recovery window, but never reaches a response.
 * Every read starts here, so a route cannot forget the filter.
 */
const live = (): StoredExpense[] =>
  db.expenses.filter((expense) => expense.deletedAt === null)

/**
 * The counts, hoisted into `meta` where the envelope puts them.
 *
 * `totals` is computed over `items` — the whole filtered set — before the page
 * is sliced out of it, which is the property everything rendering from it
 * depends on. Computing them after the slice would make them page-scoped, and
 * a count strip that changes when you turn the page is reporting nothing.
 */
const metaFor = (
  items: StoredExpense[],
  page: number,
  limit: number,
): WireMeta => {
  const sum = items.reduce((acc, expense) => acc + expense.value, 0)
  return {
    pagination: {
      page,
      limit,
      total: items.length,
      total_pages: Math.max(1, Math.ceil(items.length / limit)),
    },
    totals: {
      sum,
      count: items.length,
      average: items.length ? Math.round(sum / items.length) : 0,
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

    const matches = (expense: StoredExpense) => {
      const typeId = params.get('type_id')
      const sourceId = params.get('source_id')
      const paidBy = params.get('paid_by_user_id')
      const from = params.get('date_from')
      const to = params.get('date_to')
      if (typeId && expense.typeId !== typeId) return false
      if (sourceId && expense.sourceId !== sourceId) return false
      if (paidBy && expense.paidByUserId !== paidBy) return false
      if (from && expense.datePaid < from) return false
      if (to && expense.datePaid > to) return false
      if (search && !expense.name.toLowerCase().includes(search)) return false
      return true
    }

    const items = live()
      .filter(matches)
      .sort((a, b) =>
        ascending ? compare(a, b, sortBy) : compare(b, a, sortBy),
      )

    const start = (page - 1) * limit
    return okPage(
      items.slice(start, start + limit).map(toWire),
      metaFor(items, page, limit),
    )
  }),

  http.get('*/api/v1/expenses/:id', async ({ params }) => {
    await pause(READ_LATENCY_MS)
    const expense = live().find((row) => row.id === params.id)
    return expense ? ok(toWire(expense)) : notFound('Expense')
  }),

  http.post('*/api/v1/expenses', async ({ request }) => {
    await pause(WRITE_LATENCY_MS)
    const body = (await request.json()) as Partial<WireExpense>
    const created: StoredExpense = {
      id: nextId('exp'),
      name: body.name ?? '',
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
    const body = (await request.json()) as Partial<WireExpense>
    const index = db.expenses.findIndex(
      (expense) => expense.id === params.id && expense.deletedAt === null,
    )
    if (index === -1) return notFound('Expense')
    const current = db.expenses[index]
    db.expenses[index] = {
      ...current,
      ...(body.name !== undefined && { name: body.name }),
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
