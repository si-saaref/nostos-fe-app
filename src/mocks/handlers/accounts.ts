import { isoDay } from '@/utils/dates'
import { http } from 'msw'
import {
  fromWireMoney,
  isCanonicalWireInputMoney,
  toWireMoney,
  toWireSignedMoney,
} from '@/utils/money'
import { db, nextId } from '@/mocks/db'
import { MOCK_HOUSEHOLD, MOCK_USER } from '@/mocks/fixtures/household'
import {
  READ_LATENCY_MS,
  WRITE_LATENCY_MS,
  errorBody,
  notFound,
  ok,
  pause,
} from '@/mocks/handlers/shared'
import type {
  Account,
  AccountKind,
  BalanceAdjustment,
  WireAccount,
  WireAccountKind,
  WireBalanceAdjustment,
} from '@/types/catalog'

const toAdjustmentWire = (row: BalanceAdjustment): WireBalanceAdjustment => ({
  id: row.id,
  household_id: row.householdId,
  source_id: row.sourceId,
  created_by_user_id: row.createdByUserId,
  delta: toWireSignedMoney(row.delta),
  date: row.date,
  reason: row.reason,
  created_at: row.createdAt,
})

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

const toWire = (account: Account): WireAccount => ({
  id: account.id,
  name: account.name,
  kind: KIND_TO_WIRE[account.kind],
  opening_balance: toWireMoney(account.openingBalance),
  as_of: account.asOf,
  calculation_start_can_set: account.calculationStartCanSet === true,
  calculation_start_set_at: account.calculationStartSetAt ?? null,
  order: account.order,
  archived_at: account.archivedAt,
  household_id: account.householdId,
  system_key: account.systemKey,
})

/** Name uniqueness, enforced exactly as it is for categories. */
const nameTaken = (name: string, exceptId?: string): boolean =>
  db.accounts.some(
    (row) =>
      row.id !== exceptId &&
      row.name.trim().toLowerCase() === name.trim().toLowerCase(),
  )

const conflict = (name: string) =>
  errorBody(409, 'CONFLICT', `Akun "${name}" sudah ada`)

/** Archived rows and stable `order` for the same reasons as categories. */
export const accountHandlers = [
  http.post(
    '*/api/v1/payment-sources/:id/reconcile',
    async ({ params, request }) => {
      await pause(WRITE_LATENCY_MS)
      const source = db.accounts.find((row) => row.id === params.id)
      if (!source) return notFound('Account')
      const body = (await request.json()) as {
        target_balance: string
        reason: string
      }
      const current =
        source.openingBalance +
        db.adjustments
          .filter((row) => row.sourceId === source.id)
          .reduce((sum, row) => sum + row.delta, 0)
      const target = fromWireMoney(body.target_balance)
      const created: BalanceAdjustment = {
        id: nextId('adjustment'),
        householdId: MOCK_HOUSEHOLD.id,
        sourceId: source.id,
        createdByUserId: MOCK_USER.id,
        delta: target - current,
        date: new Date().toISOString().slice(0, 10),
        reason: body.reason.trim(),
        createdAt: new Date().toISOString(),
      }
      db.adjustments.unshift(created)
      return ok({
        adjustment: toAdjustmentWire(created),
        previous_balance: toWireSignedMoney(current),
        balance: toWireSignedMoney(target),
      })
    },
  ),
  http.get('*/api/v1/payment-sources/:id/adjustments', async ({ params }) => {
    await pause(READ_LATENCY_MS)
    const source = db.accounts.find((row) => row.id === params.id)
    if (!source) return notFound('Account')
    return ok(
      db.adjustments
        .filter((row) => row.sourceId === source.id)
        .map(toAdjustmentWire),
    )
  }),

  http.post(
    '*/api/v1/payment-sources/:id/adjustments',
    async ({ params, request }) => {
      await pause(WRITE_LATENCY_MS)
      const source = db.accounts.find((row) => row.id === params.id)
      if (!source) return notFound('Account')
      const body = (await request.json()) as {
        direction: 'INCREASE' | 'DECREASE'
        amount: string
        date: string
        reason: string
      }
      if (
        !isCanonicalWireInputMoney(body.amount) ||
        fromWireMoney(body.amount) <= 0 ||
        !body.reason?.trim() ||
        body.date < source.asOf
      ) {
        return errorBody(400, 'VALIDATION_ERROR', 'Invalid balance adjustment')
      }
      const created: BalanceAdjustment = {
        id: nextId('adjustment'),
        householdId: MOCK_HOUSEHOLD.id,
        sourceId: source.id,
        createdByUserId: MOCK_USER.id,
        delta:
          body.direction === 'DECREASE'
            ? -fromWireMoney(body.amount)
            : fromWireMoney(body.amount),
        date: body.date,
        reason: body.reason.trim(),
        createdAt: new Date().toISOString(),
      }
      db.adjustments.unshift(created)
      return ok(toAdjustmentWire(created), { status: 201 })
    },
  ),

  http.get('*/api/v1/payment-sources', async () => {
    await pause(READ_LATENCY_MS)
    return ok(db.accounts.map(toWire))
  }),

  http.post('*/api/v1/payment-sources', async ({ request }) => {
    await pause(WRITE_LATENCY_MS)
    const body = (await request.json()) as Partial<WireAccount>
    const name = (body.name ?? '').trim()
    if (nameTaken(name)) return conflict(name)
    if (
      body.opening_balance !== undefined &&
      !isCanonicalWireInputMoney(body.opening_balance, true)
    ) {
      return errorBody(400, 'VALIDATION_ERROR', 'Invalid opening balance')
    }
    const created: Account = {
      id: nextId('source'),
      name,
      kind: KIND_FROM_WIRE[body.kind ?? 'CASH'] ?? 'cash',
      openingBalance:
        body.opening_balance === undefined
          ? 0
          : fromWireMoney(body.opening_balance),
      asOf: body.as_of ?? '',
      order: db.accounts.reduce((max, row) => Math.max(max, row.order), -1) + 1,
      archivedAt: null,
      householdId: MOCK_HOUSEHOLD.id,
      systemKey: null,
      isProtected: false,
    }
    db.accounts.push(created)
    return ok(toWire(created), { status: 201 })
  }),

  http.patch('*/api/v1/payment-sources/:id', async ({ params, request }) => {
    await pause(WRITE_LATENCY_MS)
    const body = (await request.json()) as Partial<WireAccount>
    const index = db.accounts.findIndex((row) => row.id === params.id)
    if (index === -1) return notFound('Account')
    if (body.name !== undefined && nameTaken(body.name, String(params.id))) {
      return conflict(body.name)
    }
    if (body.as_of !== undefined) {
      if (!db.accounts[index].calculationStartCanSet)
        return errorBody(
          409,
          'CALCULATION_START_LOCKED',
          'Calculation start is locked',
        )
      if (body.as_of > isoDay(new Date()))
        return errorBody(400, 'FUTURE_DATE', 'Date cannot be in the future')
    }
    db.accounts[index] = {
      ...db.accounts[index],
      ...(body.name !== undefined && { name: body.name }),
      ...(body.kind !== undefined && {
        kind: KIND_FROM_WIRE[body.kind] ?? 'cash',
      }),
      ...(body.opening_balance !== undefined && {
        openingBalance: fromWireMoney(body.opening_balance),
      }),
      ...(body.as_of !== undefined && {
        asOf: body.as_of,
        calculationStartCanSet: false,
        calculationStartSetAt: new Date().toISOString(),
      }),
      ...(body.archived_at !== undefined && { archivedAt: body.archived_at }),
    }
    return ok(toWire(db.accounts[index]))
  }),
]
