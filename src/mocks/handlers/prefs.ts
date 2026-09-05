import { http, HttpResponse } from 'msw'
import { db } from '@/mocks/db'
import {
  READ_LATENCY_MS,
  WRITE_LATENCY_MS,
  pause,
} from '@/mocks/handlers/shared'
import type { HouseholdPrefs } from '@/modules/settings/types/settings'

export const prefsHandlers = [
  http.get('*/api/v1/households/:id/prefs', async () => {
    await pause(READ_LATENCY_MS)
    return HttpResponse.json(db.prefs)
  }),

  http.patch('*/api/v1/households/:id/prefs', async ({ request }) => {
    await pause(WRITE_LATENCY_MS)
    const patch = (await request.json()) as Partial<HouseholdPrefs>
    db.prefs = { ...db.prefs, ...patch }
    return HttpResponse.json(db.prefs)
  }),
]
