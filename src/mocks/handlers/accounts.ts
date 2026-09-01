import { http, HttpResponse } from 'msw'
import { db, nextId } from '@/mocks/db'
import { MOCK_HOUSEHOLD } from '@/mocks/fixtures/household'
import {
  READ_LATENCY_MS,
  WRITE_LATENCY_MS,
  notFound,
  pause,
} from '@/mocks/handlers/shared'
import type { Account } from '@/types/catalog'
import type { AccountInput } from '@/modules/settings/types/settings'

/** Archived rows are returned for the same reason as categories. */
export const accountHandlers = [
  http.get('*/api/v1/payment-sources', async () => {
    await pause(READ_LATENCY_MS)
    return HttpResponse.json(db.accounts)
  }),

  http.post('*/api/v1/payment-sources', async ({ request }) => {
    await pause(WRITE_LATENCY_MS)
    const input = (await request.json()) as AccountInput
    const created: Account = {
      id: nextId('source'),
      ...input,
      order: db.accounts.length,
      archivedAt: null,
      householdId: MOCK_HOUSEHOLD.id,
    }
    db.accounts.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.put('*/api/v1/payment-sources/:id', async ({ params, request }) => {
    await pause(WRITE_LATENCY_MS)
    const patch = (await request.json()) as Partial<Account>
    const index = db.accounts.findIndex((row) => row.id === params.id)
    if (index === -1) return notFound('Account')
    db.accounts[index] = { ...db.accounts[index], ...patch }
    return HttpResponse.json(db.accounts[index])
  }),
]
