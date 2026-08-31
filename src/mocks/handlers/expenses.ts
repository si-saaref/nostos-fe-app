import { http, HttpResponse } from 'msw'
import { db, nextId } from '@/mocks/db'
import { MOCK_HOUSEHOLD } from '@/mocks/fixtures/household'
import {
  READ_LATENCY_MS,
  WRITE_LATENCY_MS,
  notFound,
  pause,
} from '@/mocks/handlers/shared'
import type { CreateExpenseInput, Expense } from '@/types/expense'

const paginate = (items: Expense[], page: number, limit: number) => {
  const start = (page - 1) * limit
  const sum = items.reduce((acc, expense) => acc + expense.value, 0)
  return {
    items: items.slice(start, start + limit),
    pagination: {
      total: items.length,
      page,
      pages: Math.max(1, Math.ceil(items.length / limit)),
    },
    // Filter-scoped, not page-scoped: these describe the whole filtered set.
    totals: {
      sum,
      count: items.length,
      average: items.length ? Math.round(sum / items.length) : 0,
    },
  }
}

/**
 * Sort reads the API's own parameter names. It previously read `order`, which
 * is the *browser URL* name — so `sortOrder=asc` was silently ignored and the
 * mock always answered descending. A sort control built against that would
 * have looked correct and done nothing.
 */
const compare = (a: Expense, b: Expense, sortBy: string): number => {
  if (sortBy === 'value') return a.value - b.value
  if (sortBy === 'name') return a.name.localeCompare(b.name)
  return a.datePaid.localeCompare(b.datePaid)
}

export const expenseHandlers = [
  http.get('/api/expenses', async ({ request }) => {
    await pause(READ_LATENCY_MS)
    const params = new URL(request.url).searchParams
    const page = Number(params.get('page') ?? '1')
    const limit = Number(params.get('limit') ?? '25')
    const search = (params.get('search') ?? '').trim().toLowerCase()
    const sortBy = params.get('sortBy') ?? 'datePaid'
    const ascending = params.get('sortOrder') === 'asc'

    const matches = (expense: Expense) => {
      const typeId = params.get('typeId')
      const sourceId = params.get('sourceId')
      const paidBy = params.get('paidByUserId')
      const from = params.get('dateFrom')
      const to = params.get('dateTo')
      if (typeId && expense.typeId !== typeId) return false
      if (sourceId && expense.sourceId !== sourceId) return false
      if (paidBy && expense.paidByUserId !== paidBy) return false
      if (from && expense.datePaid < from) return false
      if (to && expense.datePaid > to) return false
      if (search && !expense.name.toLowerCase().includes(search)) return false
      return true
    }

    const items = db.expenses
      .filter(matches)
      .sort((a, b) =>
        ascending ? compare(a, b, sortBy) : compare(b, a, sortBy),
      )

    return HttpResponse.json(paginate(items, page, limit))
  }),

  http.get('/api/expenses/:id', async ({ params }) => {
    await pause(READ_LATENCY_MS)
    const expense = db.expenses.find((row) => row.id === params.id)
    return expense ? HttpResponse.json(expense) : notFound('Expense')
  }),

  http.post('/api/expenses', async ({ request }) => {
    await pause(WRITE_LATENCY_MS)
    const input = (await request.json()) as CreateExpenseInput
    const created: Expense = {
      id: nextId('exp'),
      householdId: MOCK_HOUSEHOLD.id,
      ...input,
    }
    db.expenses.unshift(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.put('/api/expenses/:id', async ({ params, request }) => {
    await pause(WRITE_LATENCY_MS)
    const patch = (await request.json()) as Partial<Expense>
    const index = db.expenses.findIndex((expense) => expense.id === params.id)
    if (index === -1) return notFound('Expense')
    db.expenses[index] = { ...db.expenses[index], ...patch }
    return HttpResponse.json(db.expenses[index])
  }),

  http.delete('/api/expenses/:id', async ({ params }) => {
    await pause(WRITE_LATENCY_MS)
    const exists = db.expenses.some((expense) => expense.id === params.id)
    if (!exists) return notFound('Expense')
    db.expenses = db.expenses.filter((expense) => expense.id !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),
]
