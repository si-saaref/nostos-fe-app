import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { entityKey } from '@/api/keys'
import { useInvalidatingMutation } from '@/api/useInvalidatingMutation'
import type { HouseholdPrefs } from '@/modules/settings/types/settings'

/**
 * Household preferences. Owned by Settings, read app-wide through
 * `useCurrency` — a currency the household picked has to reach every figure
 * that prints money, or the control is decoration.
 */
export const prefsKeys = {
  all: (householdId: string) => entityKey(householdId, 'household-prefs'),
}

export const useHouseholdPrefs = (householdId: string) =>
  useQuery({
    queryKey: prefsKeys.all(householdId),
    queryFn: async () =>
      (await apiClient.get<HouseholdPrefs>(`/households/${householdId}/prefs`))
        .data,
    enabled: Boolean(householdId),
  })

export const useUpdatePrefs = (householdId: string) =>
  useInvalidatingMutation(
    [prefsKeys.all(householdId)],
    (patch: Partial<HouseholdPrefs>) =>
      apiClient
        .put<HouseholdPrefs>(`/households/${householdId}/prefs`, patch)
        .then((r) => r.data),
  )
