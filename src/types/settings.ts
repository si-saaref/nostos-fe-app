import type { Role } from '@/types/household'

/** How many rim colours each theme provides. Assignment wraps beyond this. */
export const RIM_COUNT = 8

export type RimIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/**
 * Categories are flat and household-configured. `archivedAt` rather than a
 * delete: past expenses keep pointing at the category that was true when they
 * were recorded, and the ledger renders it with an archived marker.
 */
export interface Category {
  id: string
  name: string
  /** Position in the household's list — also what determines its rim colour. */
  order: number
  archivedAt: string | null
  householdId: string
}

export type AccountKind = 'cash' | 'bank' | 'ewallet'

/**
 * Accounts are where money actually sits, shared by every module rather than
 * owned by Expense. Opening balance plus an as-of date is what eventually makes
 * a real balance derivable: opening + income − expense, per account.
 */
export interface Account {
  id: string
  name: string
  kind: AccountKind
  openingBalance: number
  /** The date the opening balance was true. */
  asOf: string
  order: number
  archivedAt: string | null
  householdId: string
}

export type MemberStatus =
  'joined' | 'pending' | 'no_access' | 'left' | 'removed' | 'former'

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
  deletionReason: 'HOUSEHOLD' | 'LEFT' | 'REMOVED' | null
  /** A live, unspent invite exists for this person. */
  invitePending: boolean
  resendCount: number
}

export const memberStatus = (member: Member): MemberStatus => {
  if (member.name === 'Former member') return 'former'
  if (member.deletedAt) {
    if (member.deletionReason === 'HOUSEHOLD') return 'no_access'
    if (member.deletionReason === 'LEFT') return 'left'
    if (member.deletionReason === 'REMOVED') return 'removed'
  }
  return member.invitePending ? 'pending' : 'joined'
}

export const MAX_RESENDS = 3

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

/** ASCII-only in Phase 1 — punycode is explicitly deferred. */
export const isAsciiEmail = (email: string): boolean =>
  // eslint-disable-next-line no-control-regex
  /^[\x00-\x7F]+$/.test(email) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)

export const rimFor = (order: number): RimIndex =>
  ((order % RIM_COUNT) + 1) as RimIndex
