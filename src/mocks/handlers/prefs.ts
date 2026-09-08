import { http } from 'msw'
import { db } from '@/mocks/db'
import {
  READ_LATENCY_MS,
  WRITE_LATENCY_MS,
  ok,
  pause,
} from '@/mocks/handlers/shared'
import type { HouseholdPrefs } from '@/modules/settings/types/settings'

/** Domain → wire. The store is camelCase; only the boundary is not. */
const toWire = (prefs: HouseholdPrefs) => ({
  currency: prefs.currency,
  month_start_day: prefs.monthStartDay,
})

/** No route behind this yet. Same envelope as the rest, so shipping it is one flag. */
export const prefsHandlers = [
  http.get('*/api/v1/households/:id/prefs', async () => {
    await pause(READ_LATENCY_MS)
    return ok(toWire(db.prefs))
  }),

  http.patch('*/api/v1/households/:id/prefs', async ({ request }) => {
    await pause(WRITE_LATENCY_MS)
    const patch = (await request.json()) as {
      currency?: string
      month_start_day?: number
    }
    db.prefs = {
      ...db.prefs,
      ...(patch.currency !== undefined && { currency: patch.currency }),
      ...(patch.month_start_day !== undefined && {
        monthStartDay: patch.month_start_day,
      }),
    }
    return ok(toWire(db.prefs))
  }),
]
