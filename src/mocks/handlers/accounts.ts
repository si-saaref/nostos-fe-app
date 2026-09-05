import { http } from 'msw'
import { db, nextId } from '@/mocks/db'
import { MOCK_HOUSEHOLD } from '@/mocks/fixtures/household'
import {
  READ_LATENCY_MS,
  WRITE_LATENCY_MS,
  notFound,
  ok,
  pause,
} from '@/mocks/handlers/shared'
import type { Account, AccountKind, WireAccount } from '@/types/catalog'

const toWire = (account: Account): WireAccount => ({
  id: account.id,
  name: account.name,
  kind: account.kind,
  opening_balance: account.openingBalance,
  as_of: account.asOf,
  order: account.order,
  archived_at: account.archivedAt,
  household_id: account.householdId,
})

/** Archived rows and stable `order` for the same reasons as categories. */
export const accountHandlers = [
  http.get('*/api/v1/payment-sources', async () => {
    await pause(READ_LATENCY_MS)
    return ok(db.accounts.map(toWire))
  }),

  http.post('*/api/v1/payment-sources', async ({ request }) => {
    await pause(WRITE_LATENCY_MS)
    const body = (await request.json()) as Partial<WireAccount>
    const created: Account = {
      id: nextId('source'),
      name: body.name ?? '',
      kind: (body.kind ?? 'cash') as AccountKind,
      openingBalance: body.opening_balance ?? 0,
      asOf: body.as_of ?? '',
      order: db.accounts.reduce((max, row) => Math.max(max, row.order), -1) + 1,
      archivedAt: null,
      householdId: MOCK_HOUSEHOLD.id,
    }
    db.accounts.push(created)
    return ok(toWire(created), { status: 201 })
  }),

  http.patch('*/api/v1/payment-sources/:id', async ({ params, request }) => {
    await pause(WRITE_LATENCY_MS)
    const body = (await request.json()) as Partial<WireAccount>
    const index = db.accounts.findIndex((row) => row.id === params.id)
    if (index === -1) return notFound('Account')
    db.accounts[index] = {
      ...db.accounts[index],
      ...(body.name !== undefined && { name: body.name }),
      ...(body.kind !== undefined && { kind: body.kind }),
      ...(body.opening_balance !== undefined && {
        openingBalance: body.opening_balance,
      }),
      ...(body.as_of !== undefined && { asOf: body.as_of }),
      ...(body.archived_at !== undefined && { archivedAt: body.archived_at }),
    }
    return ok(toWire(db.accounts[index]))
  }),
]
