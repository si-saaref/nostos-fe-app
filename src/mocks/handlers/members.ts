import { http } from 'msw'
import { db, nextId } from '@/mocks/db'
import { MOCK_HOUSEHOLD } from '@/mocks/fixtures/household'
import { isAsciiEmail } from '@/utils/validators'
import { Role } from '@/types/household'
import { MAX_RESENDS } from '@/modules/settings/lib/memberStatus'
import { isoDay } from '@/utils/dates'
import {
  READ_LATENCY_MS,
  WRITE_LATENCY_MS,
  errorBody,
  notFound,
  ok,
  pause,
} from '@/mocks/handlers/shared'
import type {
  InviteInput,
  Member,
  WireMember,
  WireMemberStatus,
} from '@/modules/settings/types/settings'

/** 48 hours, matching the invite TTL the API documents. */
const INVITE_TTL_MS = 48 * 60 * 60 * 1000

/**
 * Status, derived here rather than stored — which is the point of shipping it
 * from the server at all. The FE used to recompute this from `deleted_at`,
 * `deletion_reason` and `invite_pending`; those fields are still on the
 * payload, but the derivation now has one home.
 *
 * Order matters: a tombstone outranks an invite. Someone removed while an
 * invite was still live is removed, not pending.
 */
const statusOf = (member: Member, now: number): WireMemberStatus => {
  if (member.deletedAt) {
    if (member.deletionReason === 'HOUSEHOLD') return 'no_access'
    if (member.deletionReason === 'LEFT') return 'left'
    return 'removed'
  }
  if (!member.inviteExpiresAt) return 'joined'
  return Date.parse(member.inviteExpiresAt) < now ? 'invite_expired' : 'pending'
}

const toWire = (member: Member, now = Date.now()): WireMember => ({
  id: member.id,
  name: member.name,
  email: member.email,
  role: member.role,
  household_id: member.householdId,
  status: statusOf(member, now),
  resend_count: member.resendCount,
  invite_sent_at: member.inviteSentAt,
  invite_expires_at: member.inviteExpiresAt,
  deleted_at: member.deletedAt,
  deletion_reason: member.deletionReason,
})

export const memberHandlers = [
  /**
   * The whole household in one list, tombstones included.
   *
   * This is also the ledger's attribution roster — there is no `/users`. The
   * roster used to be a second endpoint that filtered tombstones out, which
   * meant a removed member's historical expenses resolved to `—`. Returning
   * them here is what makes attribution survive removal; callers that want
   * only live members narrow client-side.
   */
  http.get('*/api/v1/households/:id/members', async () => {
    await pause(READ_LATENCY_MS)
    const now = Date.now()
    return ok(db.members.map((member) => toWire(member, now)))
  }),

  http.post('*/api/v1/households/:id/members', async ({ request }) => {
    await pause(WRITE_LATENCY_MS)
    const input = (await request.json()) as InviteInput
    if (!input.name?.trim()) {
      return errorBody(400, 'VALIDATION_ERROR', 'Name is required')
    }
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
    const sentAt = new Date()
    const created: Member = {
      id: nextId('user'),
      name: input.name.trim(),
      email: input.email,
      role: Role.MEMBER,
      householdId: MOCK_HOUSEHOLD.id,
      status: 'pending',
      resendCount: 0,
      inviteSentAt: sentAt.toISOString(),
      inviteExpiresAt: new Date(sentAt.getTime() + INVITE_TTL_MS).toISOString(),
      deletedAt: null,
      deletionReason: null,
    }
    db.members.push(created)
    return ok(toWire(created), { status: 201 })
  }),

  http.post(
    '*/api/v1/households/:id/members/:memberId/resend-invite',
    async ({ params }) => {
      await pause(WRITE_LATENCY_MS)
      const member = db.members.find((row) => row.id === params.memberId)
      if (!member) return notFound('Member')
      if (member.deletedAt || !member.inviteExpiresAt) {
        return errorBody(
          409,
          'CONFLICT',
          'This member has no invite to resend.',
        )
      }
      // 429, not 409: the ration is a throttle, and the FE's retry predicate
      // and copy both key off which of the two it is. The mock answered 409
      // here, so the exhausted-resend branch was wired to a status the API
      // never sends.
      if (member.resendCount >= MAX_RESENDS) {
        return errorBody(
          429,
          'TOO_MANY_REQUESTS',
          'Max resends reached. Remove and re-invite.',
        )
      }
      const sentAt = new Date()
      member.resendCount += 1
      member.inviteSentAt = sentAt.toISOString()
      member.inviteExpiresAt = new Date(
        sentAt.getTime() + INVITE_TTL_MS,
      ).toISOString()
      return ok(toWire(member))
    },
  ),

  http.delete(
    '*/api/v1/households/:id/members/:memberId',
    async ({ params }) => {
      await pause(WRITE_LATENCY_MS)
      const member = db.members.find((row) => row.id === params.memberId)
      if (!member) return notFound('Member')
      if (member.role === Role.ADMIN) {
        return errorBody(
          409,
          'CONFLICT',
          'The household admin cannot be removed.',
        )
      }
      // Tombstoned, never destroyed: expense attribution has to survive.
      member.deletedAt = isoDay(new Date())
      member.deletionReason = 'REMOVED'
      member.inviteSentAt = null
      member.inviteExpiresAt = null
      return ok(toWire(member))
    },
  ),
]
