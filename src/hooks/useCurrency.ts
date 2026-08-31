import { useHousehold } from '@/contexts/useHousehold'
import { useHouseholdPrefs } from '@/modules/settings/api/prefs'

/**
 * The household's currency, for every figure that prints money.
 *
 * Settings owns the preference; everything else reads it through here. React
 * Query dedupes the request, so a screen with a dozen amounts still makes one.
 */
export const useCurrency = (): string => {
  const { householdId } = useHousehold()
  const { data } = useHouseholdPrefs(householdId)
  return data?.currency ?? 'IDR'
}
