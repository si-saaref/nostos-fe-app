import { MOCK_HOUSEHOLD } from '@/mocks/fixtures/household'
import type { Category } from '@/types/catalog'

const NAMES = ['Belanja', 'Utilitas', 'Transport', 'Makan luar']

export const CATEGORY_IDS = [
  'type-belanja',
  'type-utilitas',
  'type-transport',
  'type-makan',
] as const

export const seedCategories = (): Category[] =>
  NAMES.map((name, index) => ({
    id: CATEGORY_IDS[index],
    name,
    order: index,
    archivedAt: null,
    householdId: MOCK_HOUSEHOLD.id,
  }))
