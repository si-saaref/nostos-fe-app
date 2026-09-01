import { http, HttpResponse } from 'msw'
import { MOCK_ME } from '@/mocks/fixtures/household'
import { authState } from '@/mocks/db'
import {
  READ_LATENCY_MS,
  WRITE_LATENCY_MS,
  errorBody,
  pause,
} from '@/mocks/handlers/shared'

/**
 * The v1 auth API, kept but NOT registered by default — auth runs against the
 * real backend now (see `handlers/index.ts`). Two things keep this from
 * rotting: tests opt in with `server.use(...authHandlers)`, and setting
 * `VITE_MOCK_AUTH=true` re-registers it for offline work.
 *
 * Three addresses drive the unhappy paths on demand:
 *   contains "belum"  → 401, never invited
 *   contains "limit"  → 429, ration spent
 *   contains "hapus"  → 403, household in its deletion grace
 */
export const authHandlers = [
  http.post('*/api/v1/auth/signin', async ({ request }) => {
    await pause(WRITE_LATENCY_MS)
    const { email } = (await request.json()) as { email: string }

    if (email.includes('belum')) {
      return errorBody(401, 'UNAUTHORIZED', 'No active user has this address')
    }
    if (email.includes('limit')) {
      return errorBody(429, 'TOO_MANY_REQUESTS', 'Too many signin requests')
    }
    if (email.includes('hapus')) {
      // The only error carrying a `details` payload, so it cannot go through
      // `errorBody` — the modal is useless without the date.
      return HttpResponse.json(
        {
          success: false,
          status_code: 403,
          error: {
            code: 'FORBIDDEN',
            message: 'This household is being deleted.',
          },
          details: { deletion_scheduled_for: '2026-09-26' },
        },
        { status: 403 },
      )
    }

    authState.authenticated = true
    return HttpResponse.json({
      success: true,
      message: 'Check your email for a signin link',
      data: { email },
    })
  }),

  http.get('*/api/v1/auth/me', async () => {
    await pause(READ_LATENCY_MS)
    if (!authState.authenticated) {
      return errorBody(401, 'UNAUTHENTICATED', 'Not authenticated')
    }
    return HttpResponse.json({ success: true, data: MOCK_ME })
  }),

  http.post('*/api/v1/auth/logout', async () => {
    await pause(WRITE_LATENCY_MS)
    authState.authenticated = false
    return HttpResponse.json({ success: true, message: 'Logged out', data: {} })
  }),
]
