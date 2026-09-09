import { sumMoney } from '@/utils/money'
import type { Paginated } from '@/types/api'
import type { Income } from '@/types/income'

/**
 * The two month figures the API does not send, and the flag that says whether
 * they may be shown.
 *
 * `meta.totals` carries `sum`, `count` and `average` — nothing that separates
 * money which arrived from money which merely moved. Both are derivable from
 * the rows, and both are derivable *honestly* only while the page holds every
 * row in the filtered set. So each is `null` rather than a partial sum: the
 * strip renders a dash, which is a true statement about what is known, while a
 * partial total would be a false statement about the household's month.
 *
 * The same guard the expenses page's top-slice lives under, for the same
 * reason. It costs nothing in practice — the statement asks for 400 rows and a
 * heavy month is thirty — and it is what makes the figure trustworthy when it
 * does appear.
 */
export interface IncomeMonthFigures {
  /** Entries that came from outside the household. */
  externalCount: number | null
  /** Entries that moved money between the household's own sources. */
  transferCount: number | null
  /** How much those transfers moved. Never part of net inflow. */
  moved: number | null
  isComplete: boolean
}

const UNKNOWN: IncomeMonthFigures = {
  externalCount: null,
  transferCount: null,
  moved: null,
  isComplete: false,
}

export const incomeMonthFigures = (
  page: Paginated<Income> | undefined,
): IncomeMonthFigures => {
  if (!page) return UNKNOWN
  if (page.items.length < page.pagination.total) return UNKNOWN

  const transfers = page.items.filter((row) => row.fromSourceId !== null)
  return {
    externalCount: page.items.length - transfers.length,
    transferCount: transfers.length,
    moved: sumMoney(transfers.map((row) => row.amount)),
    isComplete: true,
  }
}
