import { MOCK_HOUSEHOLD } from '@/mocks/fixtures/household'
import type { IncomeType } from '@/types/income'

/**
 * The six words the onboarding offers a household with no types of its own
 * (PRD AC1.5). Presets, not a taxonomy: clicking one creates a real row the
 * household then owns, and a household is free to type something else instead.
 *
 * Deliberately lowercase. These are the household's own words for their money,
 * and title-casing them would be the app deciding how Bahasa Indonesia works.
 */
export const INCOME_TYPE_PRESETS = [
  'salary',
  'bonus',
  'gift',
  'withdrawal',
  'deposit',
  'refund',
] as const

/** The seeded household already has types, so it never sees the presets. */
export const INCOME_TYPE_NAMES = [
  'gaji',
  'bonus',
  'hadiah',
  'tarik tunai',
  'setoran',
] as const

export const seedIncomeTypes = (): IncomeType[] =>
  INCOME_TYPE_NAMES.map((name, index) => ({
    id: `itype-${index}`,
    name,
    archivedAt: null,
    householdId: MOCK_HOUSEHOLD.id,
  }))
