import { MOCK_HOUSEHOLD } from '@/mocks/fixtures/household'
import { Role } from '@/types/household'
import type { User } from '@/types/household'
import type { Member } from '@/modules/settings/types/settings'

export const seedMembers = (): Member[] => [
  {
    id: 'user-001',
    name: 'Budi',
    email: 'budi@example.com',
    role: Role.ADMIN,
    householdId: MOCK_HOUSEHOLD.id,
    deletedAt: null,
    deletionReason: null,
    invitePending: false,
    resendCount: 0,
  },
  {
    id: 'user-002',
    name: 'Sari',
    email: 'sari@example.com',
    role: Role.MEMBER,
    householdId: MOCK_HOUSEHOLD.id,
    deletedAt: null,
    deletionReason: null,
    invitePending: false,
    resendCount: 0,
  },
  {
    id: 'user-003',
    name: 'Rina',
    email: 'rina@example.com',
    role: Role.MEMBER,
    householdId: MOCK_HOUSEHOLD.id,
    deletedAt: null,
    deletionReason: null,
    invitePending: false,
    resendCount: 0,
  },
  {
    id: 'user-004',
    name: 'Asep',
    email: 'asep@example.com',
    role: Role.MEMBER,
    householdId: MOCK_HOUSEHOLD.id,
    deletedAt: null,
    deletionReason: null,
    invitePending: true,
    resendCount: 1,
  },
  {
    id: 'user-005',
    name: 'Dewi',
    email: 'dewi@example.com',
    role: Role.MEMBER,
    householdId: MOCK_HOUSEHOLD.id,
    deletedAt: '2026-07-02',
    deletionReason: 'LEFT',
    invitePending: false,
    resendCount: 0,
  },
]

/**
 * `/users` is the attribution roster, derived from the membership list rather
 * than kept as a second hardcoded array — so someone invited in Settings shows
 * up in the expense "paid by" picker, the way the real API behaves.
 */
export const toUser = (member: Member): User => ({
  id: member.id,
  name: member.name,
  email: member.email,
  role: member.role,
  householdId: member.householdId,
})
