import { http } from 'msw'
import { db, nextId } from '@/mocks/db'
import { MOCK_HOUSEHOLD } from '@/mocks/fixtures/household'
import {
  READ_LATENCY_MS,
  WRITE_LATENCY_MS,
  errorBody,
  notFound,
  ok,
  pause,
} from '@/mocks/handlers/shared'
import type { IncomeType, WireIncomeType } from '@/types/income'

const toWire = (type: IncomeType): WireIncomeType => ({
  id: type.id,
  name: type.name,
  archived_at: type.archivedAt,
  household_id: type.householdId,
})

const NAME_MAX = 100

export const incomeTypeHandlers = [
  http.get('*/api/v1/income-types', async () => {
    await pause(READ_LATENCY_MS)
    return ok(db.incomeTypes.map(toWire))
  }),

  http.post('*/api/v1/income-types', async ({ request }) => {
    await pause(WRITE_LATENCY_MS)
    const body = (await request.json()) as { name?: string }
    const name = (body.name ?? '').trim()
    if (!name || name.length > NAME_MAX) {
      return errorBody(400, 'VALIDATION_ERROR', 'Validation failed', [
        {
          field: 'name',
          code: 'LENGTH',
          message: `name must be 1–${NAME_MAX} characters`,
        },
      ])
    }
    // `UNIQUE(household_id, name)` (PRD §5). Case-insensitive, because
    // "Gaji" and "gaji" are one word to the family that typed them, and two
    // rows for it would split their own history.
    const clash = db.incomeTypes.find(
      (row) => row.name.toLowerCase() === name.toLowerCase(),
    )
    if (clash) {
      return errorBody(409, 'DUPLICATE_NAME', `"${clash.name}" sudah ada`)
    }
    const created: IncomeType = {
      id: nextId('itype'),
      name,
      archivedAt: null,
      householdId: MOCK_HOUSEHOLD.id,
    }
    db.incomeTypes.push(created)
    return ok(toWire(created), { status: 201 })
  }),

  http.patch('*/api/v1/income-types/:id', async ({ params, request }) => {
    await pause(WRITE_LATENCY_MS)
    const body = (await request.json()) as Partial<WireIncomeType>
    const index = db.incomeTypes.findIndex((row) => row.id === params.id)
    if (index === -1) return notFound('Income type')
    db.incomeTypes[index] = {
      ...db.incomeTypes[index],
      ...(body.name !== undefined && { name: body.name }),
      ...(body.archived_at !== undefined && { archivedAt: body.archived_at }),
    }
    return ok(toWire(db.incomeTypes[index]))
  }),
]
