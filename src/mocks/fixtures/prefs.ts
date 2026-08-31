import type { HouseholdPrefs } from '@/modules/settings/types/settings'

export const seedPrefs = (): HouseholdPrefs => ({
  currency: 'IDR',
  monthStartDay: 1,
})
