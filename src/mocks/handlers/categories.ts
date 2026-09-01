import { http, HttpResponse } from 'msw'
import { db, nextId } from '@/mocks/db'
import { MOCK_HOUSEHOLD } from '@/mocks/fixtures/household'
import {
  READ_LATENCY_MS,
  WRITE_LATENCY_MS,
  notFound,
  pause,
} from '@/mocks/handlers/shared'
import type { Category } from '@/types/catalog'
import type { CategoryInput } from '@/modules/settings/types/settings'

/**
 * Archived rows are returned, not filtered out.
 *
 * `archivedAt` exists precisely so a category survives its own retirement, and
 * the settings UI renders the archived badge and the Restore action off that
 * field. Hiding archived rows here made archiving one-way: it vanished from the
 * list, and the control meant to bring it back could never render. Callers that
 * want only live rows narrow client-side (`useActiveCategories`).
 */
export const categoryHandlers = [
  http.get('*/api/v1/expense-types', async () => {
    await pause(READ_LATENCY_MS)
    return HttpResponse.json(db.categories)
  }),

  http.post('*/api/v1/expense-types', async ({ request }) => {
    await pause(WRITE_LATENCY_MS)
    const input = (await request.json()) as CategoryInput
    const created: Category = {
      id: nextId('type'),
      name: input.name,
      order: db.categories.length,
      archivedAt: null,
      householdId: MOCK_HOUSEHOLD.id,
    }
    db.categories.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.put('*/api/v1/expense-types/:id', async ({ params, request }) => {
    await pause(WRITE_LATENCY_MS)
    const patch = (await request.json()) as Partial<Category>
    const index = db.categories.findIndex((row) => row.id === params.id)
    if (index === -1) return notFound('Category')
    db.categories[index] = { ...db.categories[index], ...patch }
    return HttpResponse.json(db.categories[index])
  }),
]
