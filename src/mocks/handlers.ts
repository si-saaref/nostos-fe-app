import { http, HttpResponse } from 'msw'
import type { CreateExpenseInput, Expense } from '@/types/expense'
import {
  MOCK_HOUSEHOLD,
  MOCK_SOURCES,
  MOCK_TYPES,
  MOCK_USER,
  authState,
  db,
  nextExpenseId,
} from '@/mocks/data'

const paginate = (items: Expense[], page: number, limit: number) => {
  const start = (page - 1) * limit
  return {
    items: items.slice(start, start + limit),
    pagination: {
      total: items.length,
      page,
      pages: Math.max(1, Math.ceil(items.length / limit)),
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
    const typeId = url.searchParams.get('typeId')
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '25')

    let items = [...db.expenses]
    if (typeId) {
      items = items.filter((expense) => expense.typeId === typeId)
    }
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

  http.get('/api/users', () => HttpResponse.json([MOCK_USER])),
]
