import { MOCK_HOUSEHOLD, MOCK_USER } from '@/mocks/fixtures/household'
import { isoDay } from '@/utils/dates'
import type { StoredIncome } from '@/types/income'

/**
 * A transfer-heavy demo ledger, because that is what a real month looks like:
 * two or three arrivals from outside and five or six movements between the
 * household's own sources. A fixture of pure salaries would let a design that
 * renders a withdrawal as earnings look correct.
 */
interface Recipe {
  /** Day of the month. Day 1 carries both an arrival and a movement, so the
   *  current month is never a single-entry month on the 1st or 2nd. */
  day: number
  name: string
  type: string
  /** `null` is money from outside the household. */
  from: string | null
  to: string
  amount: number
  /** Only in months whose index (0 = this month, counting back) matches. */
  everyOtherMonth?: boolean
}

const RECIPES: Recipe[] = [
  {
    day: 1,
    name: 'Gaji bulan ini',
    type: 'gaji',
    from: null,
    to: 'source-bni',
    amount: 8600000,
  },
  {
    day: 1,
    name: 'Tarik tunai awal bulan',
    type: 'tarik tunai',
    from: 'source-bni',
    to: 'source-tunai',
    amount: 1200000,
  },
  {
    day: 2,
    name: 'Setor sisa QRIS',
    type: 'setoran',
    from: 'source-qris',
    to: 'source-bni',
    amount: 185000,
  },
  {
    day: 4,
    name: 'Top up GoPay',
    type: 'setoran',
    from: 'source-debit',
    to: 'source-ewallet',
    amount: 300000,
  },
  {
    day: 9,
    name: 'Tarik tunai',
    type: 'tarik tunai',
    from: 'source-bni',
    to: 'source-tunai',
    amount: 500000,
  },
  {
    day: 12,
    name: 'Bonus kuartal',
    type: 'bonus',
    from: null,
    to: 'source-bsi',
    amount: 4250000,
    everyOtherMonth: true,
  },
  {
    day: 16,
    name: 'Tarik tunai',
    type: 'tarik tunai',
    from: 'source-bni',
    to: 'source-tunai',
    amount: 450000,
  },
  {
    day: 20,
    name: 'Hadiah ulang tahun',
    type: 'hadiah',
    from: null,
    to: 'source-tunai',
    amount: 600000,
    everyOtherMonth: true,
  },
  {
    day: 23,
    name: 'Top up GoPay',
    type: 'setoran',
    from: 'source-debit',
    to: 'source-ewallet',
    amount: 250000,
  },
  {
    day: 27,
    name: 'Tarik tunai akhir bulan',
    type: 'tarik tunai',
    from: 'source-bni',
    to: 'source-tunai',
    amount: 400000,
  },
]

/** How many months back the demo ledger runs, so "vs last month" has an answer. */
const MONTHS = 4

let seq = 0
const id = () => `inc-${String(++seq).padStart(4, '0')}`

/**
 * Newest first, and never dated into the future — a ledger records what has
 * already happened, and a fixture that seeded the 23rd on the 8th would make
 * the future-date rule untestable and the month totals a fiction.
 */
export const seedIncome = (): StoredIncome[] => {
  seq = 0
  const today = new Date()
  const todayIso = isoDay(today)
  const rows: StoredIncome[] = []

  for (let back = 0; back < MONTHS; back += 1) {
    const month = new Date(today.getFullYear(), today.getMonth() - back, 1)
    RECIPES.filter(
      (recipe) => !recipe.everyOtherMonth || back % 2 === 0,
    ).forEach((recipe) => {
      const date = isoDay(
        new Date(month.getFullYear(), month.getMonth(), recipe.day),
      )
      if (date > todayIso) return
      rows.push({
        id: id(),
        name: recipe.name,
        amount: recipe.amount,
        type: recipe.type,
        fromSourceId: recipe.from,
        toSourceId: recipe.to,
        date,
        householdId: MOCK_HOUSEHOLD.id,
        createdByUserId: MOCK_USER.id,
        createdAt: `${date}T03:12:00.000Z`,
        updatedByAdminId: null,
        updatedAt: null,
        deletedAt: null,
      })
    })
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date))
}
