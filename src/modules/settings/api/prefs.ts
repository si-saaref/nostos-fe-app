import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import { entityKey } from '@/api/keys'
import { useInvalidatingMutation } from '@/api/useInvalidatingMutation'
import type { ApiEnvelope } from '@/types/api'
import type {
  HouseholdPrefs,
  WireHouseholdPrefs,
} from '@/modules/settings/types/settings'

/**
 * Household preferences. Owned by Settings, read app-wide through
 * `useCurrency` — a currency the household picked has to reach every figure
 * that prints money, or the control is decoration.
 *
 * Not shipped: the live API 404s, which `PreferencesSection` renders as "not
 * available yet". Written against the envelope anyway.
 */
export const prefsKeys = {
  all: (householdId: string) => entityKey(householdId, 'household-prefs'),
}

const toPrefs = (row: WireHouseholdPrefs): HouseholdPrefs => ({
  currency: row.currency,
  monthStartDay: row.month_start_day,
})

/** Only the keys the caller passed — a partial body, like every other PATCH. */
const toPrefsBody = (patch: Partial<HouseholdPrefs>) => {
  const body: Record<string, unknown> = {}
  if (patch.currency !== undefined) body.currency = patch.currency
  if (patch.monthStartDay !== undefined) {
    body.month_start_day = patch.monthStartDay
  }
  return body
}

const prefsPath = (householdId: string) => `/households/${householdId}/prefs`

export const useHouseholdPrefs = (householdId: string) =>
  useQuery({
    queryKey: prefsKeys.all(householdId),
    queryFn: async () =>
      toPrefs(
        unwrap(
          await apiClient.get<ApiEnvelope<WireHouseholdPrefs>>(
            prefsPath(householdId),
          ),
        ),
      ),
    enabled: Boolean(householdId),
  })

export const useUpdatePrefs = (householdId: string) =>
  useInvalidatingMutation(
    [prefsKeys.all(householdId)],
    async (patch: Partial<HouseholdPrefs>) =>
      toPrefs(
        unwrap(
          await apiClient.patch<ApiEnvelope<WireHouseholdPrefs>>(
            prefsPath(householdId),
            toPrefsBody(patch),
          ),
        ),
      ),
  )
