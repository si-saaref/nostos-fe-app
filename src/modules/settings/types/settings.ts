import type { Role } from '@/types/household'
import type { AccountKind } from '@/types/catalog'

export type MemberStatus =
  'joined' | 'pending' | 'no_access' | 'left' | 'removed' | 'former'

export type MemberDeletionReason = 'HOUSEHOLD' | 'LEFT' | 'REMOVED' | null

/**
 * Member status is derived from the payload, never stored as a column
 * (auth PRD v3.1 §3.2).
 */
export interface Member {
  id: string
  name: string
  email: string
  role: Role
  householdId: string
  deletedAt: string | null
  deletionReason: MemberDeletionReason
  /** A live, unspent invite exists for this person. */
  invitePending: boolean
  resendCount: number
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
