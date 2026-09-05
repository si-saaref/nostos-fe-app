import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import { entityKey } from '@/api/keys'
import { useInvalidatingMutation } from '@/api/useInvalidatingMutation'
import type { ApiEnvelope } from '@/types/api'
import type { User } from '@/types/household'
import type {
  InviteInput,
  Member,
  WireMember,
} from '@/modules/settings/types/settings'

/**
 * People, from one endpoint.
 *
 * `GET /households/:id/members` is the whole household: live members, pending
 * invites, and the tombstones of everyone who has left or been removed. There
 * used to be a second endpoint, `/users`, serving the ledger's "paid by"
 * roster — and because it filtered tombstones out, a removed member's
 * historical expenses resolved to `—`. Attribution has to survive removal, so
 * the roster is now a `select` over this list rather than its own request:
 * one key, one response type, and no way for the two views to disagree.
 */
export const memberKeys = {
  all: (householdId: string) => entityKey(householdId, 'members'),
}

/** Wire → domain. The only place a snake_case member key is spelled out. */
export const toMember = (row: WireMember): Member => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  householdId: row.household_id,
  status: row.status,
  resendCount: row.resend_count,
  inviteSentAt: row.invite_sent_at,
  inviteExpiresAt: row.invite_expires_at,
  deletedAt: row.deleted_at,
  deletionReason: row.deletion_reason,
})

/** Domain → wire, for the invite body. */
const toInviteBody = (input: InviteInput) => ({
  name: input.name,
  email: input.email,
})

/** The subset the ledger needs to put a name on a row. */
const toRosterUser = (member: Member): User => ({
  id: member.id,
  name: member.name,
  email: member.email,
  role: member.role,
  householdId: member.householdId,
})

const membersPath = (householdId: string) =>
  `/households/${householdId}/members`

const fetchMembers = async (householdId: string): Promise<Member[]> =>
  unwrap(
    await apiClient.get<ApiEnvelope<WireMember[]>>(membersPath(householdId)),
  ).map(toMember)

/** The administrative view: everyone, tombstones included. */
export const useMembers = (householdId: string) =>
  useQuery({
    queryKey: memberKeys.all(householdId),
    queryFn: () => fetchMembers(householdId),
    enabled: Boolean(householdId),
  })

/**
 * Everyone a historical expense could be attributed to — tombstoned members
 * included, which is the entire point. Use this for resolving a name that is
 * already on a row, and for filtering the ledger by who paid.
 */
export const useRoster = (householdId: string) =>
  useQuery({
    queryKey: memberKeys.all(householdId),
    queryFn: () => fetchMembers(householdId),
    enabled: Boolean(householdId),
    select: (members: Member[]) => members.map(toRosterUser),
  })

/**
 * Who a *new* expense may be attributed to. A removed member keeps their
 * history but cannot be handed fresh spending, so the picker narrows where
 * the roster does not.
 */
export const useActivePayers = (householdId: string) =>
  useQuery({
    queryKey: memberKeys.all(householdId),
    queryFn: () => fetchMembers(householdId),
    enabled: Boolean(householdId),
    select: (members: Member[]) =>
      members.filter((member) => !member.deletedAt).map(toRosterUser),
  })

const invalidates = (householdId: string) => [memberKeys.all(householdId)]

export const useInviteMember = (householdId: string) =>
  useInvalidatingMutation(
    invalidates(householdId),
    async (input: InviteInput) =>
      toMember(
        unwrap(
          await apiClient.post<ApiEnvelope<WireMember>>(
            membersPath(householdId),
            toInviteBody(input),
          ),
        ),
      ),
  )

export const useResendInvite = (householdId: string) =>
  useInvalidatingMutation(invalidates(householdId), async (memberId: string) =>
    toMember(
      unwrap(
        await apiClient.post<ApiEnvelope<WireMember>>(
          `${membersPath(householdId)}/${memberId}/resend-invite`,
        ),
      ),
    ),
  )

export const useRemoveMember = (householdId: string) =>
  useInvalidatingMutation(invalidates(householdId), async (memberId: string) =>
    toMember(
      unwrap(
        await apiClient.delete<ApiEnvelope<WireMember>>(
          `${membersPath(householdId)}/${memberId}`,
        ),
      ),
    ),
  )
