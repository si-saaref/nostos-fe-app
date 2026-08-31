import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { entityKey } from '@/api/keys'
import { useInvalidatingMutation } from '@/api/useInvalidatingMutation'
import type { User } from '@/types/household'
import type { InviteInput, Member } from '@/modules/settings/types/settings'

/**
 * People, from two endpoints that describe the same household.
 *
 * `/households/:id/members` is the administrative view — tombstones, invite
 * state, resend counts. `/users` is the roster the ledger attributes rows to.
 * They live together because every membership write changes both, and a write
 * that refreshed only one left the expense "paid by" picker a session behind.
 */
export const memberKeys = {
  all: (householdId: string) => entityKey(householdId, 'members'),
}

export const userKeys = {
  all: (householdId: string) => entityKey(householdId, 'users'),
}

/** Both keys, because every membership write moves both lists. */
const peopleKeys = (householdId: string) => [
  memberKeys.all(householdId),
  userKeys.all(householdId),
]

export const useMembers = (householdId: string) =>
  useQuery({
    queryKey: memberKeys.all(householdId),
    queryFn: async () =>
      (await apiClient.get<Member[]>(`/households/${householdId}/members`))
        .data,
    enabled: Boolean(householdId),
  })

export const useUsers = (householdId: string) =>
  useQuery({
    queryKey: userKeys.all(householdId),
    queryFn: async () => (await apiClient.get<User[]>('/users')).data,
    enabled: Boolean(householdId),
  })

export const useInviteMember = (householdId: string) =>
  useInvalidatingMutation(peopleKeys(householdId), (input: InviteInput) =>
    apiClient
      .post<Member>(`/households/${householdId}/members`, input)
      .then((r) => r.data),
  )

export const useResendInvite = (householdId: string) =>
  useInvalidatingMutation(peopleKeys(householdId), (memberId: string) =>
    apiClient
      .post(`/households/${householdId}/members/${memberId}/resend-invite`)
      .then((r) => r.data),
  )

export const useRemoveMember = (householdId: string) =>
  useInvalidatingMutation(peopleKeys(householdId), (memberId: string) =>
    apiClient
      .delete(`/households/${householdId}/members/${memberId}`)
      .then((r) => r.data),
  )
