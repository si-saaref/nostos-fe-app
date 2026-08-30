import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type {
  Account,
  AccountInput,
  Category,
  CategoryInput,
  HouseholdPrefs,
  InviteInput,
  Member,
} from '@/types/settings'

export const SETTINGS_KEYS = {
  categories: (householdId: string) => ['categories', householdId] as const,
  accounts: (householdId: string) => ['accounts', householdId] as const,
  members: (householdId: string) => ['members', householdId] as const,
  prefs: (householdId: string) => ['household-prefs', householdId] as const,
}

/* ------------------------------------------------------------------ reads */

export const useCategories = (householdId: string) =>
  useQuery({
    queryKey: SETTINGS_KEYS.categories(householdId),
    queryFn: async () =>
      (await apiClient.get<Category[]>('/expense-types')).data,
    enabled: Boolean(householdId),
  })

export const useAccounts = (householdId: string) =>
  useQuery({
    queryKey: SETTINGS_KEYS.accounts(householdId),
    queryFn: async () =>
      (await apiClient.get<Account[]>('/payment-sources')).data,
    enabled: Boolean(householdId),
  })

export const useMembers = (householdId: string) =>
  useQuery({
    queryKey: SETTINGS_KEYS.members(householdId),
    queryFn: async () =>
      (await apiClient.get<Member[]>(`/households/${householdId}/members`))
        .data,
    enabled: Boolean(householdId),
  })

export const useHouseholdPrefs = (householdId: string) =>
  useQuery({
    queryKey: SETTINGS_KEYS.prefs(householdId),
    queryFn: async () =>
      (await apiClient.get<HouseholdPrefs>(`/households/${householdId}/prefs`))
        .data,
    enabled: Boolean(householdId),
  })

/* -------------------------------------------------------------- mutations */

/** Every settings mutation invalidates its own list and nothing else. */
const useListMutation = <TInput, TResult>(
  key: readonly unknown[],
  run: (input: TInput) => Promise<TResult>,
) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export const useCreateCategory = (householdId: string) =>
  useListMutation(
    SETTINGS_KEYS.categories(householdId),
    (input: CategoryInput) =>
      apiClient.post<Category>('/expense-types', input).then((r) => r.data),
  )

export const useUpdateCategory = (householdId: string) =>
  useListMutation(
    SETTINGS_KEYS.categories(householdId),
    ({ id, ...patch }: { id: string } & Partial<Category>) =>
      apiClient
        .put<Category>(`/expense-types/${id}`, patch)
        .then((r) => r.data),
  )

export const useCreateAccount = (householdId: string) =>
  useListMutation(SETTINGS_KEYS.accounts(householdId), (input: AccountInput) =>
    apiClient.post<Account>('/payment-sources', input).then((r) => r.data),
  )

export const useUpdateAccount = (householdId: string) =>
  useListMutation(
    SETTINGS_KEYS.accounts(householdId),
    ({ id, ...patch }: { id: string } & Partial<Account>) =>
      apiClient
        .put<Account>(`/payment-sources/${id}`, patch)
        .then((r) => r.data),
  )

export const useInviteMember = (householdId: string) =>
  useListMutation(SETTINGS_KEYS.members(householdId), (input: InviteInput) =>
    apiClient
      .post<Member>(`/households/${householdId}/members`, input)
      .then((r) => r.data),
  )

export const useResendInvite = (householdId: string) =>
  useListMutation(SETTINGS_KEYS.members(householdId), (memberId: string) =>
    apiClient
      .post(`/households/${householdId}/members/${memberId}/resend-invite`)
      .then((r) => r.data),
  )

export const useRemoveMember = (householdId: string) =>
  useListMutation(SETTINGS_KEYS.members(householdId), (memberId: string) =>
    apiClient
      .delete(`/households/${householdId}/members/${memberId}`)
      .then((r) => r.data),
  )

export const useUpdatePrefs = (householdId: string) =>
  useListMutation(
    SETTINGS_KEYS.prefs(householdId),
    (patch: Partial<HouseholdPrefs>) =>
      apiClient
        .put<HouseholdPrefs>(`/households/${householdId}/prefs`, patch)
        .then((r) => r.data),
  )
