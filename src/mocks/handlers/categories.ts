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
import type { Category, WireCategory } from '@/types/catalog'

const toWire = (category: Category): WireCategory => ({
  id: category.id,
  name: category.name,
  order: category.order,
  archived_at: category.archivedAt,
  household_id: category.householdId,
})

/**
 * Archived rows are returned, not filtered out.
 *
 * `archived_at` exists precisely so a category survives its own retirement,
 * and the settings UI renders the archived badge and the Restore action off
 * that field. Hiding archived rows here made archiving one-way: it vanished
 * from the list, and the control meant to bring it back could never render.
 * Callers that want only live rows narrow client-side
 * (`useActiveCategories`).
 *
 * `order` is server-assigned and stable: the FE derives each category's rim
 * colour from it, so a value that shifted when a sibling was archived would
 * repaint half the ledger.
 */
export const categoryHandlers = [
  http.get('*/api/v1/expense-types', async () => {
    await pause(READ_LATENCY_MS)
    return ok(db.categories.map(toWire))
  }),

  http.post('*/api/v1/expense-types', async ({ request }) => {
    await pause(WRITE_LATENCY_MS)
    const body = (await request.json()) as { name?: string }
    const created: Category = {
      id: nextId('type'),
      name: body.name ?? '',
      // Highest existing order plus one, never the array length: archiving
      // does not renumber, so length would eventually collide.
      order:
        db.categories.reduce((max, row) => Math.max(max, row.order), -1) + 1,
      archivedAt: null,
      householdId: MOCK_HOUSEHOLD.id,
    }
    db.categories.push(created)
    return ok(toWire(created), { status: 201 })
  }),

  http.patch('*/api/v1/expense-types/:id', async ({ params, request }) => {
    await pause(WRITE_LATENCY_MS)
    const body = (await request.json()) as Partial<WireCategory>
    const index = db.categories.findIndex((row) => row.id === params.id)
    if (index === -1) return notFound('Category')
    db.categories[index] = {
      ...db.categories[index],
      ...(body.name !== undefined && { name: body.name }),
      ...(body.archived_at !== undefined && { archivedAt: body.archived_at }),
    }
    return ok(toWire(db.categories[index]))
  }),
]
