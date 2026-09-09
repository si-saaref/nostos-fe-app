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

/**
 * Ids matching what `seedIncomeTypes` assigns, so a fixture ledger and the
 * type catalogue cannot drift apart. Derived from the index rather than
 * written out twice.
 */
export const INCOME_TYPE_IDS: string[] = INCOME_TYPE_NAMES.map(
  (_, index) => `itype-${index}`,
)

export const incomeTypeIdOf = (name: string): string => {
  const index = (INCOME_TYPE_NAMES as readonly string[]).indexOf(name)
  // Throws rather than returning a dangling id: a fixture ledger pointing at a
  // type that was never seeded is the bug this helper exists to prevent.
  if (index === -1) throw new Error(`No seeded income type named "${name}"`)
  return INCOME_TYPE_IDS[index]
}

export const seedIncomeTypes = (): IncomeType[] =>
  INCOME_TYPE_NAMES.map((name, index) => ({
    id: `itype-${index}`,
    name,
    archivedAt: null,
    householdId: MOCK_HOUSEHOLD.id,
  }))
