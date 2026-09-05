import { MOCK_HOUSEHOLD } from '@/mocks/fixtures/household'
import { Role } from '@/types/household'
import type { Member } from '@/modules/settings/types/settings'

/**
 * `status` is present on the seed rows but is not what the handler answers
 * with — `statusOf` derives it per request, because `invite_expired` depends
 * on the clock and a stored value would go stale between reloads. The field
 * stays on the row so the store's type is the domain type.
 */
const joined = (
  id: string,
  name: string,
  email: string,
  role: Role = Role.MEMBER,
): Member => ({
  id,
  name,
  email,
  role,
  householdId: MOCK_HOUSEHOLD.id,
  status: 'joined',
  resendCount: 0,
  inviteSentAt: null,
  inviteExpiresAt: null,
  deletedAt: null,
  deletionReason: null,
})

const hoursFromNow = (hours: number) =>
  new Date(Date.now() + hours * 3_600_000).toISOString()

export const seedMembers = (): Member[] => [
  joined('user-001', 'Budi', 'budi@example.com', Role.ADMIN),
  joined('user-002', 'Sari', 'sari@example.com'),
  joined('user-003', 'Rina', 'rina@example.com'),
  {
    // A live invite with one resend spent — the "Resend · 2 left" state.
    ...joined('user-004', 'Asep', 'asep@example.com'),
    status: 'pending',
    resendCount: 1,
    inviteSentAt: hoursFromNow(-6),
    inviteExpiresAt: hoursFromNow(42),
  },
  {
    // Tombstoned, and still on the list: Dewi's old expenses have to keep
    // resolving to a name.
    ...joined('user-005', 'Dewi', 'dewi@example.com'),
    status: 'left',
    deletedAt: '2026-07-02',
    deletionReason: 'LEFT',
  },
  {
    // An invite nobody spent. Expired rather than pending, so the status the
    // API distinguishes has something to render against.
    ...joined('user-006', 'Tono', 'tono@example.com'),
    status: 'invite_expired',
    resendCount: 3,
    inviteSentAt: hoursFromNow(-72),
    inviteExpiresAt: hoursFromNow(-24),
  },
]
