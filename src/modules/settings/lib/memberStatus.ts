import type { Member, MemberStatus } from '@/modules/settings/types/settings'

/** Invite resends allowed per member before an admin must remove and re-invite. */
export const MAX_RESENDS = 3

/**
 * The name the server gives the placeholder row that survives a hard-deleted
 * person, so their historical expenses still resolve to something.
 */
export const FORMER_MEMBER_NAME = 'Former member'

/**
 * The status to render.
 *
 * Server-derived now: `member.status` arrives on the payload, so this is a
 * lookup rather than a second implementation of the same rule. The one thing
 * it still decides is `former` — the placeholder row is not a membership
 * state, so the server has no status to send for it, and the check comes
 * first because that row's `status` describes a person who is no longer there
 * to have one.
 */
export const memberStatus = (member: Member): MemberStatus =>
  member.name === FORMER_MEMBER_NAME ? 'former' : member.status

/** Resends left on this member's current invite, never negative. */
export const resendsLeft = (member: Member): number =>
  Math.max(0, MAX_RESENDS - member.resendCount)
