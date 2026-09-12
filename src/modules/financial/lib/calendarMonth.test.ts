import { describe, expect, it } from 'vitest'
import {
  buildCalendarMonth,
  leadingBlanks,
  markFraction,
} from '@/modules/financial/lib/calendarMonth'
import type { Paginated } from '@/types/api'
import type { Expense } from '@/types/expense'
import type { Income } from '@/types/income'

const expense = (datePaid: string, value: number, id = datePaid): Expense => ({
  id: `e-${id}-${value}`,
  name: 'Sayur & buah pasar',
  value,
  typeId: 'type-belanja',
  sourceId: 'source-tunai',
  datePaid,
  paidByUserId: 'user-1',
  householdId: 'h1',
})

const income = (
  date: string,
  amount: number,
  fromSourceId: string | null = null,
): Income => ({
  id: `i-${date}-${amount}`,
  name: fromSourceId ? 'Tarik tunai' : 'Gaji',
  amount,
  typeId: 'itype-0',
  fromSourceId,
  toSourceId: 'source-bsi',
  date,
  householdId: 'h1',
})

const page = <T>(items: T[], total = items.length): Paginated<T> => ({
  items,
  pagination: { page: 1, limit: 500, total, totalPages: 1 },
})

const SEPTEMBER = new Date(2026, 8, 1)

describe('leadingBlanks', () => {
  it('counts the Monday-start offset of the first of the month', () => {
    // 1 September 2026 is a Tuesday, so one blank precedes it.
    expect(leadingBlanks(SEPTEMBER)).toBe(1)
  })

  it('is zero when the month opens on a Monday', () => {
    // 1 June 2026 is a Monday.
    expect(leadingBlanks(new Date(2026, 5, 1))).toBe(0)
  })

  it('is six when the month opens on a Sunday', () => {
    // 1 November 2026 is a Sunday.
    expect(leadingBlanks(new Date(2026, 10, 1))).toBe(6)
  })
})

describe('buildCalendarMonth', () => {
  it('draws every day of the month, spent or not', () => {
    const month = buildCalendarMonth(SEPTEMBER, page([]), page([]))
    expect(month.days).toHaveLength(30)
    expect(month.days[0].date).toBe('2026-09-01')
    expect(month.days[29].date).toBe('2026-09-30')
  })

  it('sums a day of expenses onto its own cell', () => {
    const month = buildCalendarMonth(
      SEPTEMBER,
      page([expense('2026-09-03', 87000), expense('2026-09-03', 24000, 'b')]),
      page([]),
    )
    const third = month.days[2]
    expect(third.spent).toBe(111000)
    expect(third.expenses).toHaveLength(2)
    expect(third.count).toBe(2)
  })

  it('keeps arrival and movement apart on a day that holds both', () => {
    const month = buildCalendarMonth(
      SEPTEMBER,
      page([]),
      page([
        income('2026-09-02', 8500000),
        income('2026-09-02', 2000000, 'source-bsi'),
      ]),
    )
    const second = month.days[1]
    expect(second.inflow).toBe(8500000)
    expect(second.moved).toBe(2000000)
  })

  it('ignores rows dated outside the month', () => {
    const month = buildCalendarMonth(
      SEPTEMBER,
      page([expense('2026-08-31', 500000)]),
      page([income('2026-10-01', 900000)]),
    )
    expect(month.days.every((day) => day.count === 0)).toBe(true)
  })

  it('scales each stream against its own busiest day', () => {
    // One shared scale would draw the salary at full height and the whole
    // month's spending as stubs beneath it.
    const month = buildCalendarMonth(
      SEPTEMBER,
      page([expense('2026-09-05', 333000), expense('2026-09-07', 24000, 'b')]),
      page([income('2026-09-02', 8500000)]),
    )
    expect(month.maxSpent).toBe(333000)
    expect(month.maxInflow).toBe(8500000)
  })

  it('names the busiest spending day', () => {
    const month = buildCalendarMonth(
      SEPTEMBER,
      page([expense('2026-09-05', 333000), expense('2026-09-07', 24000, 'b')]),
      page([]),
    )
    expect(month.busiest?.date).toBe('2026-09-05')
  })

  it('has no busiest day when nothing was spent', () => {
    const month = buildCalendarMonth(SEPTEMBER, page([]), page([]))
    expect(month.busiest).toBeNull()
  })

  it('is complete when both pages hold every row of their set', () => {
    const month = buildCalendarMonth(
      SEPTEMBER,
      page([expense('2026-09-01', 1000)]),
      page([income('2026-09-01', 2000)]),
    )
    expect(month.isComplete).toBe(true)
  })

  it('is incomplete when either page is a slice of a larger set', () => {
    const month = buildCalendarMonth(
      SEPTEMBER,
      page([expense('2026-09-01', 1000)], 612),
      page([income('2026-09-01', 2000)]),
    )
    // A drawn month would be missing days, so nothing may be drawn from it.
    expect(month.isComplete).toBe(false)
  })

  it('is incomplete while either response has not arrived', () => {
    expect(buildCalendarMonth(SEPTEMBER, undefined, page([])).isComplete).toBe(
      false,
    )
    expect(buildCalendarMonth(SEPTEMBER, page([]), undefined).isComplete).toBe(
      false,
    )
  })

  it('reports the entry count from the filtered set, not the page', () => {
    const month = buildCalendarMonth(
      SEPTEMBER,
      page([expense('2026-09-01', 1000)], 18),
      page([income('2026-09-01', 2000)], 5),
    )
    expect(month.entryCount).toBe(23)
  })
})

describe('markFraction', () => {
  it('is the value against the busiest day of its own stream', () => {
    expect(markFraction(333000, 333000)).toBe(1)
    expect(markFraction(166500, 333000)).toBe(0.5)
  })

  it('is zero for a day with nothing in that stream', () => {
    expect(markFraction(0, 333000)).toBe(0)
  })

  it('is zero rather than infinite when the month has no maximum', () => {
    expect(markFraction(0, 0)).toBe(0)
  })

  it('never returns a fraction so small the mark disappears', () => {
    // A Rp 5.000 parking fee in a month with a Rp 5.000.000 day is still a day
    // something happened on, and a 0.1% bar is indistinguishable from none.
    expect(markFraction(5000, 5000000)).toBeGreaterThanOrEqual(0.08)
  })
})
