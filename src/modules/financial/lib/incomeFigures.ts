import { sumMoney } from '@/utils/money'
import type { Paginated } from '@/types/api'
import type { Income } from '@/types/income'

/**
 * The three month figures that separate money which arrived from money which
 * merely moved, and the flag that says whether they may be shown.
 *
 * The server computes all three over the whole filtered set, so when
 * `meta.totals` carries them they are simply true — a partial page included.
 * When it does not, they are derived from the rows on hand, which is honest
 * only while the page holds every row in the set: hence the guard, and hence
 * `null` rather than a partial sum. A dash is a true statement about what is
 * known; a partial total is a false statement about the household's month.
 *
 * The fallback is not dead code. `meta.totals` is absent from the API's own
 * OpenAPI schema, so a deployment that does not send it is a real case.
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

  const {
    moved,
    external_count: external,
    transfer_count: transfers,
  } = page.totals ?? {}
  // All three together, never two of them: a response carrying part of the set
  // is a contract this cannot read, and guessing the rest would put an
  // invented figure on the strip.
  if (
    moved !== undefined &&
    external !== undefined &&
    transfers !== undefined
  ) {
    return {
      externalCount: external,
      transferCount: transfers,
      moved,
      isComplete: true,
    }
  }

  if (page.items.length < page.pagination.total) return UNKNOWN

  const moving = page.items.filter((row) => row.fromSourceId !== null)
  return {
    externalCount: page.items.length - moving.length,
    transferCount: moving.length,
    moved: sumMoney(moving.map((row) => row.amount)),
    isComplete: true,
  }
}
