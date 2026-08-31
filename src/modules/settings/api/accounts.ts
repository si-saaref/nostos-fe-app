import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { entityKey } from '@/api/keys'
import { useInvalidatingMutation } from '@/api/useInvalidatingMutation'
import type { Account } from '@/types/catalog'
import type { AccountInput } from '@/modules/settings/types/settings'

/** `/payment-sources` — one key, one type, one hook. See `categories.ts`. */
export const accountKeys = {
  all: (householdId: string) => entityKey(householdId, 'accounts'),
}

const fetchAccounts = async (): Promise<Account[]> =>
  (await apiClient.get<Account[]>('/payment-sources')).data

export const useAccounts = (householdId: string) =>
  useQuery({
    queryKey: accountKeys.all(householdId),
    queryFn: fetchAccounts,
    enabled: Boolean(householdId),
  })

/** What a picker should offer: archived accounts are history, not choices. */
export const useActiveAccounts = (householdId: string) =>
  useQuery({
    queryKey: accountKeys.all(householdId),
    queryFn: fetchAccounts,
    enabled: Boolean(householdId),
    select: (accounts: Account[]) =>
      accounts.filter((account) => !account.archivedAt),
  })

export const useCreateAccount = (householdId: string) =>
  useInvalidatingMutation(
    [accountKeys.all(householdId)],
    (input: AccountInput) =>
      apiClient.post<Account>('/payment-sources', input).then((r) => r.data),
  )

export const useUpdateAccount = (householdId: string) =>
  useInvalidatingMutation(
    [accountKeys.all(householdId)],
    ({ id, ...patch }: { id: string } & Partial<Account>) =>
      apiClient
        .put<Account>(`/payment-sources/${id}`, patch)
        .then((r) => r.data),
  )
