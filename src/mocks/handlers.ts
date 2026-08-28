import { http, HttpResponse } from 'msw'
import type { CreateExpenseInput, Expense } from '@/types/expense'
import {
  MOCK_HOUSEHOLD,
  MOCK_SOURCES,
  MOCK_TYPES,
  MOCK_USER,
  MOCK_USERS,
  authState,
  db,
  nextExpenseId,
} from '@/mocks/data'

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

export const handlers = [
  http.post('/api/auth/login', async () => {
    authState.authenticated = true
    return HttpResponse.json({ user: MOCK_USER, household: MOCK_HOUSEHOLD })
  }),

  http.post('/api/auth/logout', () => {
    authState.authenticated = false
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/auth/session', () => {
    if (!authState.authenticated) {
      return new HttpResponse(null, { status: 401 })
    }
    return HttpResponse.json({ user: MOCK_USER, household: MOCK_HOUSEHOLD })
  }),

  http.get('/api/expenses', ({ request }) => {
    const url = new URL(request.url)
    const params = url.searchParams
    const page = Number(params.get('page') ?? '1')
    const limit = Number(params.get('limit') ?? '25')
    const search = (params.get('search') ?? '').trim().toLowerCase()

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
        params.get('order') === 'asc'
          ? a.datePaid.localeCompare(b.datePaid)
          : b.datePaid.localeCompare(a.datePaid),
      )

    return HttpResponse.json(paginate(items, page, limit))
  }),

  http.post('/api/expenses', async ({ request }) => {
    const input = (await request.json()) as CreateExpenseInput
    const created: Expense = {
      id: nextExpenseId(),
      householdId: MOCK_HOUSEHOLD.id,
      ...input,
    }
    db.expenses.unshift(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.put('/api/expenses/:id', async ({ params, request }) => {
    const patch = (await request.json()) as Partial<Expense>
    const index = db.expenses.findIndex((expense) => expense.id === params.id)
    if (index === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    db.expenses[index] = { ...db.expenses[index], ...patch }
    return HttpResponse.json(db.expenses[index])
  }),

  http.delete('/api/expenses/:id', ({ params }) => {
    db.expenses = db.expenses.filter((expense) => expense.id !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/expense-types', () => HttpResponse.json(MOCK_TYPES)),

  http.get('/api/payment-sources', () => HttpResponse.json(MOCK_SOURCES)),

  http.get('/api/users', () => HttpResponse.json(MOCK_USERS)),
]
