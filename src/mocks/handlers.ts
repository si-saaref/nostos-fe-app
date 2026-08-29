import { http, HttpResponse } from 'msw'
import type { CreateExpenseInput, Expense } from '@/types/expense'
import type {
  Account,
  AccountInput,
  Category,
  CategoryInput,
  HouseholdPrefs,
  InviteInput,
  Member,
} from '@/types/settings'
import { MAX_RESENDS, isAsciiEmail } from '@/types/settings'
import {
  MOCK_HOUSEHOLD,
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

  /* ------------------------------------------------------------ settings */

  http.get('/api/expense-types', () =>
    HttpResponse.json(db.categories.filter((c) => !c.archivedAt)),
  ),

  http.post('/api/expense-types', async ({ request }) => {
    const input = (await request.json()) as CategoryInput
    const created: Category = {
      id: `type-${Date.now()}`,
      name: input.name,
      order: db.categories.length,
      archivedAt: null,
      householdId: MOCK_HOUSEHOLD.id,
    }
    db.categories.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.put('/api/expense-types/:id', async ({ params, request }) => {
    const patch = (await request.json()) as Partial<Category>
    const index = db.categories.findIndex((c) => c.id === params.id)
    if (index === -1) return new HttpResponse(null, { status: 404 })
    db.categories[index] = { ...db.categories[index], ...patch }
    return HttpResponse.json(db.categories[index])
  }),

  http.get('/api/payment-sources', () =>
    HttpResponse.json(db.accounts.filter((a) => !a.archivedAt)),
  ),

  http.post('/api/payment-sources', async ({ request }) => {
    const input = (await request.json()) as AccountInput
    const created: Account = {
      id: `source-${Date.now()}`,
      ...input,
      order: db.accounts.length,
      archivedAt: null,
      householdId: MOCK_HOUSEHOLD.id,
    }
    db.accounts.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.put('/api/payment-sources/:id', async ({ params, request }) => {
    const patch = (await request.json()) as Partial<Account>
    const index = db.accounts.findIndex((a) => a.id === params.id)
    if (index === -1) return new HttpResponse(null, { status: 404 })
    db.accounts[index] = { ...db.accounts[index], ...patch }
    return HttpResponse.json(db.accounts[index])
  }),

  http.get('/api/households/:id/members', () => HttpResponse.json(db.members)),

  http.post('/api/households/:id/members', async ({ request }) => {
    const input = (await request.json()) as InviteInput
    if (!isAsciiEmail(input.email)) {
      return HttpResponse.json(
        {
          success: false,
          status_code: 400,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' },
        },
        { status: 400 },
      )
    }
    if (db.members.some((m) => m.email === input.email && !m.deletedAt)) {
      // The 409 wording differs per case on purpose — it is the whole feature.
      return HttpResponse.json(
        {
          success: false,
          status_code: 409,
          error: {
            code: 'CONFLICT',
            message:
              'Already in a household. Ask them to leave it first, then invite again.',
          },
        },
        { status: 409 },
      )
    }
    const created: Member = {
      id: `user-${Date.now()}`,
      name: input.name,
      email: input.email,
      role: 'member',
      householdId: MOCK_HOUSEHOLD.id,
      deletedAt: null,
      deletionReason: null,
      invitePending: true,
      resendCount: 0,
    }
    db.members.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.post(
    '/api/households/:id/members/:memberId/resend-invite',
    ({ params }) => {
      const member = db.members.find((m) => m.id === params.memberId)
      if (!member) return new HttpResponse(null, { status: 404 })
      if (member.resendCount >= MAX_RESENDS) {
        return HttpResponse.json(
          {
            success: false,
            status_code: 409,
            error: {
              code: 'CONFLICT',
              message: 'Max resends reached. Remove and re-invite.',
            },
          },
          { status: 409 },
        )
      }
      member.resendCount += 1
      return HttpResponse.json(member)
    },
  ),

  http.delete('/api/households/:id/members/:memberId', ({ params }) => {
    const member = db.members.find((m) => m.id === params.memberId)
    if (!member) return new HttpResponse(null, { status: 404 })
    // Tombstoned, never destroyed: expense attribution has to survive.
    member.deletedAt = new Date().toISOString().slice(0, 10)
    member.deletionReason = 'REMOVED'
    member.invitePending = false
    return HttpResponse.json(member)
  }),

  http.get('/api/households/:id/prefs', () => HttpResponse.json(db.prefs)),

  http.put('/api/households/:id/prefs', async ({ request }) => {
    const patch = (await request.json()) as Partial<HouseholdPrefs>
    db.prefs = { ...db.prefs, ...patch }
    return HttpResponse.json(db.prefs)
  }),

  http.get('/api/users', () => HttpResponse.json(MOCK_USERS)),
]
