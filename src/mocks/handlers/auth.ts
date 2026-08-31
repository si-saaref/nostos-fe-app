import { http, HttpResponse } from 'msw'
import { MOCK_HOUSEHOLD, MOCK_USER } from '@/mocks/fixtures/household'
import { authState } from '@/mocks/db'
import {
  READ_LATENCY_MS,
  WRITE_LATENCY_MS,
  errorBody,
  pause,
} from '@/mocks/handlers/shared'

export const authHandlers = [
  http.post('/api/auth/login', async () => {
    await pause(WRITE_LATENCY_MS)
    authState.authenticated = true
    return HttpResponse.json({ user: MOCK_USER, household: MOCK_HOUSEHOLD })
  }),

  http.post('/api/auth/logout', async () => {
    await pause(WRITE_LATENCY_MS)
    authState.authenticated = false
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/auth/session', async () => {
    await pause(READ_LATENCY_MS)
    if (!authState.authenticated) {
      return errorBody(401, 'UNAUTHENTICATED', 'No active session')
    }
    return HttpResponse.json({ user: MOCK_USER, household: MOCK_HOUSEHOLD })
  }),
]
