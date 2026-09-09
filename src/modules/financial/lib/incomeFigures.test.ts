import { describe, expect, it } from 'vitest'
import { incomeMonthFigures } from '@/modules/financial/lib/incomeFigures'
import type { Paginated } from '@/types/api'
import type { Income } from '@/types/income'

const row = (id: string, amount: number, from: string | null): Income => ({
  id,
  name: id,
  amount,
  type: 'gaji',
  fromSourceId: from,
  toSourceId: 'source-bni',
  date: '2026-09-04',
  householdId: 'h1',
})

const page = (
  items: Income[],
  total = items.length,
  totals?: { sum: number; count: number; average: number },
): Paginated<Income> => ({
  items,
  pagination: { page: 1, limit: 400, total, totalPages: 1 },
  totals: totals ?? { sum: 0, count: total, average: 0 },
})

describe('incomeMonthFigures', () => {
  it('counts external inflows and sums what merely moved', () => {
    const figures = incomeMonthFigures(
      page([
        row('salary', 5000000, null),
        row('bonus', 4900000, null),
        row('withdraw', 400000, 'source-bni'),
        row('topup', 150000, 'source-bca'),
      ]),
    )

    expect(figures.externalCount).toBe(2)
    expect(figures.transferCount).toBe(2)
    expect(figures.moved).toBe(550000)
    expect(figures.isComplete).toBe(true)
  })

  it('reports nothing when the page does not hold the whole filtered set', () => {
    // Derived from rows on hand, so a partial page can only produce a partial
    // sum — and a partial sum presented as a month total is a wrong number.
    const figures = incomeMonthFigures(page([row('salary', 5000000, null)], 40))

    expect(figures.isComplete).toBe(false)
    expect(figures.moved).toBeNull()
    expect(figures.externalCount).toBeNull()
    expect(figures.transferCount).toBeNull()
  })

  it('is complete and empty for a month with no entries', () => {
    const figures = incomeMonthFigures(page([], 0))

    expect(figures.isComplete).toBe(true)
    expect(figures.moved).toBe(0)
    expect(figures.externalCount).toBe(0)
  })

  it('treats an absent page as incomplete rather than as zero', () => {
    const figures = incomeMonthFigures(undefined)

    expect(figures.isComplete).toBe(false)
    expect(figures.moved).toBeNull()
  })

  it('does not round two-decimal amounts into disagreement', () => {
    const figures = incomeMonthFigures(
      page([row('a', 0.1, 'source-bni'), row('b', 0.2, 'source-bni')]),
    )
    expect(figures.moved).toBe(0.3)
  })
})
