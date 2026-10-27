import type { ExpenseCategorySystemKey } from '@/types/catalog'
import type { IncomeCategorySystemKey } from '@/types/income'

export type CategoryDomain = 'expense' | 'income'
export type CategorySystemKey =
  | ExpenseCategorySystemKey
  | IncomeCategorySystemKey

const EXPENSE_ICONS: Record<ExpenseCategorySystemKey, string> = {
  FOOD_DRINK: 'food-drink',
  GROCERIES: 'groceries',
  TRANSPORTATION: 'transportation',
  BILLS: 'bills',
  HOUSING: 'housing',
  SHOPPING: 'shopping',
  HEALTH: 'health',
  ENTERTAINMENT: 'entertainment',
  EDUCATION: 'education',
  GIFTS_DONATIONS: 'gifts-donations',
  SUBSCRIPTIONS: 'subscriptions',
  OTHER: 'other-expense',
}

const INCOME_ICONS: Record<IncomeCategorySystemKey, string> = {
  SALARY: 'salary',
  BONUS: 'bonus',
  BUSINESS: 'business',
  FREELANCE: 'freelance',
  GIFT: 'gift',
  REIMBURSEMENT: 'reimbursement',
  OTHER: 'other-income',
}

const PATHS: Record<string, string> = {
  'food-drink': 'M7 3v8m3-8v8M7 7h3m5-4v8m0-8c3 2 3 6 0 8v10M8.5 11v10',
  groceries: 'M4 8h16l-1.5 11h-13L4 8zm4 0 2-5m6 5-2-5M8 13h8',
  transportation: 'M5 17h14l-1-8H6l-1 8zm2-8 2-4h6l2 4M8 17v2m8-2v2M8 13h.01m8-.01h.01',
  bills: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zm3 5h6m-6 4h6m-6 4h4',
  housing: 'M3 11l9-8 9 8M5 9v12h14V9m-9 12v-6h4v6',
  shopping: 'M5 8h14l-1 13H6L5 8zm4 0a3 3 0 0 1 6 0',
  health: 'M12 20s-8-4.5-8-10a4 4 0 0 1 7-2.5L12 9l1-1.5A4 4 0 0 1 20 10c0 5.5-8 10-8 10z',
  entertainment: 'M4 7h16v12H4V7zm4-3v3m8-3v3M8 12h.01M12 12h.01M16 12h.01',
  education: 'M3 9l9-5 9 5-9 5-9-5zm4 3v5c3 2 7 2 10 0v-5',
  'gifts-donations': 'M4 10h16v11H4V10zm-1-4h18v4H3V6zm9 15V6m0 0c-1-4-6-4-5 0m5 0c1-4 6-4 5 0',
  subscriptions: 'M6 4h12v16H6V4zm3 4h6m-6 4h6m-6 4h4',
  'other-expense': 'M5 12h.01M12 12h.01M19 12h.01',
  salary: 'M4 7h16v12H4V7zm4 0V4h8v3m-9 5h10',
  bonus: 'M12 3l2.3 4.7 5.2.8-3.8 3.7.9 5.3-4.6-2.5-4.6 2.5.9-5.3-3.8-3.7 5.2-.8L12 3z',
  business: 'M3 21V7l6-4v18m0-12 6-3v15m0-9h6v9M6 10h.01M6 14h.01M12 11h.01M12 15h.01M18 15h.01',
  freelance: 'M5 4h14v16H5V4zm3 4h8m-8 4h8m-8 4h5',
  gift: 'M4 10h16v11H4V10zm-1-4h18v4H3V6zm9 15V6m0 0c-1-4-6-4-5 0m5 0c1-4 6-4 5 0',
  reimbursement: 'M7 7h11v11M18 7l-3-3m3 3-3 3M17 17H6V6M6 17l3 3m-3-3 3-3',
  'other-income': 'M12 3v18m-5-5 5 5 5-5M7 8l5-5 5 5',
  custom: 'M12 3v18M3 12h18',
}

export const categoryIcon = (
  systemKey: CategorySystemKey | null,
  domain: CategoryDomain,
) => {
  const iconName = systemKey
    ? domain === 'expense'
      ? EXPENSE_ICONS[systemKey as ExpenseCategorySystemKey]
      : INCOME_ICONS[systemKey as IncomeCategorySystemKey]
    : 'custom'
  const resolved = iconName ?? 'custom'

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-category-icon={resolved}
      className="h-4 w-4 shrink-0"
    >
      <path d={PATHS[resolved]} />
    </svg>
  )
}
