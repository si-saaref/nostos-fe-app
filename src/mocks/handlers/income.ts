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
import { averageMoney, isValidMoney, roundMoney, sumMoney } from '@/utils/money'
import type { StoredIncome, WireIncome } from '@/types/income'

const toWire = (income: StoredIncome): WireIncome => ({
  id: income.id,
  name: income.name,
  amount: income.amount,
  type: income.type,
  from_source_id: income.fromSourceId,
  to_source_id: income.toSourceId,
  date: income.date,
  household_id: income.householdId,
  created_by_user_id: income.createdByUserId,
  updated_by_admin_id: income.updatedByAdminId,
  created_at: income.createdAt,
  updated_at: income.updatedAt,
})

/** Soft delete: a tombstoned row never reaches a response. Every read starts here. */
const live = (): StoredIncome[] =>
  db.income.filter((income) => income.deletedAt === null)

/**
 * `sum` is **net** inflow: everything that entered a source minus everything
 * that left one (AC2.3). A transfer contributes to both halves and therefore
 * cancels, which is the property that makes the figure mean "money the
 * household actually gained" rather than "rows added up".
 *
 * Computed over the whole filtered set before the page is sliced out of it — a
 * total that changes when you turn the page is reporting nothing.
 */
const metaFor = (
  items: StoredIncome[],
  page: number,
  limit: number,
): WireMeta => {
  const into = sumMoney(items.map((row) => row.amount))
  const outOf = sumMoney(
    items.filter((row) => row.fromSourceId !== null).map((row) => row.amount),
  )
  const sum = roundMoney(into - outOf)
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
      average: averageMoney(sum, items.length),
    },
  }
}

const MAX_LIMIT = 500

/** Tomorrow, not today: Jakarta is UTC+7, so local today can be UTC yesterday. */
const tomorrowUtc = (): string =>
  new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

const liveSource = (id: string) =>
  db.accounts.some((row) => row.id === id && row.archivedAt === null)

/**
 * The server's own order: whitelist first, then field constraints, then refs.
 *
 * `from_source_id` is the one nullable field, so `null` is a legal value here
 * and not a validation failure — it is how "this came from outside the
 * household" is spelled.
 */
const badBody = (body: Partial<WireIncome> & Record<string, unknown>) => {
  if ('household_id' in body) {
    return errorBody(
      400,
      'WHITELIST_VALIDATION',
      'property household_id should not exist',
    )
  }
  if (body.amount !== undefined && !isValidMoney(body.amount)) {
    return errorBody(400, 'VALIDATION_ERROR', 'Validation failed', [
      {
        field: 'amount',
        code: 'IS_DECIMAL',
        message: 'amount must be positive with at most 2 decimal places',
      },
    ])
  }
  if (body.date !== undefined && body.date > tomorrowUtc()) {
    return errorBody(400, 'FUTURE_DATE', 'date cannot be in the future')
  }
  if (body.type !== undefined && !String(body.type).trim()) {
    return errorBody(400, 'VALIDATION_ERROR', 'Validation failed', [
      { field: 'type', code: 'IS_NOT_EMPTY', message: 'type is required' },
    ])
  }
  return null
}

/**
 * References, and the one rule the PRD's acceptance criteria never wrote down
 * but its own review flagged: a transfer to the source it came from moves
 * nothing and means nothing.
 */
const badRef = (
  body: Partial<WireIncome>,
  current?: StoredIncome,
): ReturnType<typeof errorBody> | null => {
  if (body.to_source_id !== undefined && !liveSource(body.to_source_id)) {
    return errorBody(422, 'INVALID_SOURCE', 'Sumber tujuan tidak tersedia')
  }
  if (
    body.from_source_id !== undefined &&
    body.from_source_id !== null &&
    !liveSource(body.from_source_id)
  ) {
    return errorBody(422, 'INVALID_SOURCE', 'Sumber asal tidak tersedia')
  }
  // Resolved against the row being patched, not just the body: an admin who
  // changes only `to_source_id` can still land it on the existing `from`.
  const from =
    body.from_source_id !== undefined
      ? body.from_source_id
      : (current?.fromSourceId ?? null)
  const to =
    body.to_source_id !== undefined ? body.to_source_id : current?.toSourceId
  if (from !== null && to !== undefined && from === to) {
    return errorBody(
      400,
      'SAME_SOURCE',
      'Tidak bisa memindahkan dana ke sumber yang sama',
    )
  }
  return null
}

const PATH = '*/api/v1/households/:householdId/income'

export const incomeHandlers = [
  http.get(PATH, async ({ request }) => {
    await pause(READ_LATENCY_MS)
    const params = new URL(request.url).searchParams
    const page = Number(params.get('page') ?? '1')
    const limit = Number(params.get('limit') ?? '25')

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

    const from = params.get('date_from')
    const to = params.get('date_to')
    const items = live()
      .filter((row) => {
        if (from && row.date < from) return false
        if (to && row.date > to) return false
        return true
      })
      // Date descending, with the id as the tiebreak so two entries on the
      // same day keep a stable order across refetches. Sorting deferred by the
      // PRD means this order is the contract, not a default.
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

    const start = (page - 1) * limit
    // A page past the end is an empty list with real totals, never a 404
    // (AC2.4): the household's month has a sum whether or not page 9 exists.
    return okPage(
      items.slice(start, start + limit).map(toWire),
      metaFor(items, page, limit),
    )
  }),

  http.post(PATH, async ({ request }) => {
    await pause(WRITE_LATENCY_MS)
    const body = (await request.json()) as Partial<WireIncome> &
      Record<string, unknown>
    if (body.to_source_id === undefined) {
      return errorBody(400, 'VALIDATION_ERROR', 'Validation failed', [
        {
          field: 'to_source_id',
          code: 'IS_NOT_EMPTY',
          message: 'to_source_id is required',
        },
      ])
    }
    const rejected = badBody(body) ?? badRef(body)
    if (rejected) return rejected

    const created: StoredIncome = {
      id: nextId('inc'),
      name: body.name ?? '',
      amount: body.amount ?? 0,
      type: body.type ?? '',
      fromSourceId: body.from_source_id ?? null,
      toSourceId: body.to_source_id,
      date: body.date ?? '',
      householdId: MOCK_HOUSEHOLD.id,
      createdByUserId: MOCK_USER.id,
      createdAt: new Date().toISOString(),
      updatedByAdminId: null,
      updatedAt: null,
      deletedAt: null,
    }
    db.income.unshift(created)
    return ok(toWire(created), { status: 201 })
  }),

  http.patch(`${PATH}/:incomeId`, async ({ params, request }) => {
    await pause(WRITE_LATENCY_MS)
    const body = (await request.json()) as Partial<WireIncome> &
      Record<string, unknown>

    // Three-way PATCH (AC3.4): absent leaves it alone, a value writes it, null
    // clears it. Only `from_source_id` is nullable, so a null anywhere else is
    // a 400 rather than a silent no-op.
    const nulled = Object.keys(body).find(
      (key) => body[key] === null && key !== 'from_source_id',
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

    const index = db.income.findIndex(
      (row) => row.id === params.incomeId && row.deletedAt === null,
    )
    if (index === -1) return notFound('Income')
    const current = db.income[index]

    const rejected = badBody(body) ?? badRef(body, current)
    if (rejected) return rejected

    db.income[index] = {
      ...current,
      ...(body.name !== undefined && { name: body.name }),
      ...(body.amount !== undefined && { amount: body.amount }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.from_source_id !== undefined && {
        fromSourceId: body.from_source_id,
      }),
      ...(body.to_source_id !== undefined && {
        toSourceId: body.to_source_id,
      }),
      ...(body.date !== undefined && { date: body.date }),
      updatedByAdminId: MOCK_USER.id,
      updatedAt: new Date().toISOString(),
    }
    return ok(toWire(db.income[index]))
  }),

  http.delete(`${PATH}/:incomeId`, async ({ params }) => {
    await pause(WRITE_LATENCY_MS)
    const income = db.income.find(
      (row) => row.id === params.incomeId && row.deletedAt === null,
    )
    // A second delete is a 404, indistinguishable from a row that never
    // existed (AC4.9) — the tombstone is not a resource.
    if (!income) return notFound('Income')
    income.deletedAt = new Date().toISOString()
    return ok(null, { message: 'Income deleted' })
  }),
]
