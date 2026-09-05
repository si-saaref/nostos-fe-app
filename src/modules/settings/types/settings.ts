import type { Role } from '@/types/household'
import type { AccountKind } from '@/types/catalog'

/**
 * The six states the server derives and sends, plus `former` — which the
 * server never sends, because it is not a membership state at all but the
 * placeholder row that keeps a deleted person's expenses attributable.
 */
export type WireMemberStatus =
  'joined' | 'pending' | 'invite_expired' | 'no_access' | 'left' | 'removed'

export type MemberStatus = WireMemberStatus | 'former'

export type MemberDeletionReason = 'HOUSEHOLD' | 'LEFT' | 'REMOVED' | null

/**
 * `GET|POST /households/:id/members` on the wire, snake_case as sent.
 *
 * `status` is shipped by the server, derived from the latest invite and never
 * stored (auth PRD v3.1 §3.2). It used to be re-derived here from
 * `deleted_at` / `deletion_reason` / `invite_pending` — one derivation in two
 * places, which is one too many: the server already computes it for the invite
 * response, so a divergence would show as a member reading `joined` on one
 * screen and `pending` on another.
 */
export interface WireMember {
  id: string
  name: string
  email: string
  role: Role
  household_id: string
  status: WireMemberStatus
  /** Resends spent on the current invite. `0` when there is no invite. */
  resend_count: number
  /** `null` means delivery failed — a resend is the recovery. */
  invite_sent_at: string | null
  invite_expires_at: string | null
  deleted_at: string | null
  deletion_reason: MemberDeletionReason
}

export interface Member {
  id: string
  name: string
  email: string
  role: Role
  householdId: string
  status: WireMemberStatus
  resendCount: number
  inviteSentAt: string | null
  inviteExpiresAt: string | null
  deletedAt: string | null
  deletionReason: MemberDeletionReason
}

export interface HouseholdPrefs {
  currency: string
  /** Day of month the household's period starts. 1 for most households. */
  monthStartDay: number
}

export interface CategoryInput {
  name: string
}

export interface AccountInput {
  name: string
  kind: AccountKind
  openingBalance: number
  asOf: string
}

export interface InviteInput {
  name: string
  email: string
}
