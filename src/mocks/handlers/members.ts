import { http, HttpResponse } from 'msw'
import { db, nextId } from '@/mocks/db'
import { MOCK_HOUSEHOLD } from '@/mocks/fixtures/household'
import { toUser } from '@/mocks/fixtures/members'
import { isAsciiEmail } from '@/utils/validators'
import { MAX_RESENDS } from '@/modules/settings/lib/memberStatus'
import { isoDay } from '@/utils/dates'
import {
  READ_LATENCY_MS,
  WRITE_LATENCY_MS,
  errorBody,
  notFound,
  pause,
} from '@/mocks/handlers/shared'
import type { InviteInput, Member } from '@/modules/settings/types/settings'

export const memberHandlers = [
  http.get('/api/households/:id/members', async () => {
    await pause(READ_LATENCY_MS)
    return HttpResponse.json(db.members)
  }),

  http.post('/api/households/:id/members', async ({ request }) => {
    await pause(WRITE_LATENCY_MS)
    const input = (await request.json()) as InviteInput
    if (!isAsciiEmail(input.email)) {
      return errorBody(400, 'VALIDATION_ERROR', 'Invalid email format')
    }
    if (
      db.members.some(
        (member) => member.email === input.email && !member.deletedAt,
      )
    ) {
      // The 409 wording differs per case on purpose — it is the whole feature.
      return errorBody(
        409,
        'CONFLICT',
        'Already in a household. Ask them to leave it first, then invite again.',
      )
    }
    const created: Member = {
      id: nextId('user'),
      name: input.name,
      email: input.email,
      role: 'member',
      householdId: MOCK_HOUSEHOLD.id,
      deletedAt: null,
      deletionReason: null,
      invitePending: true,
      resendCount: 0,
    }
    db.members.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.post(
    '/api/households/:id/members/:memberId/resend-invite',
    async ({ params }) => {
      await pause(WRITE_LATENCY_MS)
      const member = db.members.find((row) => row.id === params.memberId)
      if (!member) return notFound('Member')
      if (member.resendCount >= MAX_RESENDS) {
        return errorBody(
          409,
          'CONFLICT',
          'Max resends reached. Remove and re-invite.',
        )
      }
      member.resendCount += 1
      return HttpResponse.json(member)
    },
  ),

  http.delete('/api/households/:id/members/:memberId', async ({ params }) => {
    await pause(WRITE_LATENCY_MS)
    const member = db.members.find((row) => row.id === params.memberId)
    if (!member) return notFound('Member')
    // Tombstoned, never destroyed: expense attribution has to survive.
    member.deletedAt = isoDay(new Date())
    member.deletionReason = 'REMOVED'
    member.invitePending = false
    return HttpResponse.json(member)
  }),

  // Attribution roster, derived from the membership list so an invite reaches
  // the expense "paid by" picker without a second source of truth.
  http.get('/api/users', async () => {
    await pause(READ_LATENCY_MS)
    return HttpResponse.json(
      db.members.filter((member) => !member.deletedAt).map(toUser),
    )
  }),
]
