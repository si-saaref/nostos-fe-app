import { render } from '@testing-library/react'
import { categoryIcon } from '@/modules/settings/lib/categoryIcon'
import type { ExpenseCategorySystemKey } from '@/types/catalog'
import type { IncomeCategorySystemKey } from '@/types/income'

const EXPENSE_KEYS: ExpenseCategorySystemKey[] = [
  'FOOD_DRINK',
  'GROCERIES',
  'TRANSPORTATION',
  'BILLS',
  'HOUSING',
  'SHOPPING',
  'HEALTH',
  'ENTERTAINMENT',
  'EDUCATION',
  'GIFTS_DONATIONS',
  'SUBSCRIPTIONS',
  'OTHER',
]

const INCOME_KEYS: IncomeCategorySystemKey[] = [
  'SALARY',
  'BONUS',
  'BUSINESS',
  'FREELANCE',
  'GIFT',
  'REIMBURSEMENT',
  'OTHER',
]

describe('categoryIcon', () => {
  it.each([
    ...EXPENSE_KEYS.map((key) => [key, 'expense'] as const),
    ...INCOME_KEYS.map((key) => [key, 'income'] as const),
  ])('maps %s in the %s domain without falling back', (key, domain) => {
    const { container } = render(categoryIcon(key, domain))
    expect(container.querySelector('[data-category-icon]'))
      .not.toHaveAttribute('data-category-icon', 'custom')
  })

  it.each(['expense', 'income'] as const)(
    'uses the generic custom icon for a null %s key',
    (domain) => {
      const { container } = render(categoryIcon(null, domain))
      expect(container.querySelector('[data-category-icon]'))
        .toHaveAttribute('data-category-icon', 'custom')
    },
  )
})
