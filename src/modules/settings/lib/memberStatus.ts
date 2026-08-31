import type { Member, MemberStatus } from '@/modules/settings/types/settings'

/** Invite resends allowed per member before an admin must remove and re-invite. */
export const MAX_RESENDS = 3

export const memberStatus = (member: Member): MemberStatus => {
  if (member.name === 'Former member') return 'former'
  if (member.deletedAt) {
    if (member.deletionReason === 'HOUSEHOLD') return 'no_access'
    if (member.deletionReason === 'LEFT') return 'left'
    if (member.deletionReason === 'REMOVED') return 'removed'
  }
  return member.invitePending ? 'pending' : 'joined'
}
