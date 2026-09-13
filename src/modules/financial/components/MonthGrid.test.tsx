import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { MonthGrid } from '@/modules/financial/components/MonthGrid'
import { buildCalendarMonth } from '@/modules/financial/lib/calendarMonth'
import type { Paginated } from '@/types/api'
import type { Expense } from '@/types/expense'
import type { Income } from '@/types/income'

const SEPTEMBER = new Date(2026, 8, 1)
const TODAY = '2026-09-12'

const expense = (datePaid: string, value: number): Expense => ({
  id: `e-${datePaid}-${value}`,
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
  name: 'Gaji',
  amount,
  typeId: 'itype-0',
  fromSourceId,
  toSourceId: 'source-bsi',
  date,
  householdId: 'h1',
})

const page = <T,>(items: T[]): Paginated<T> => ({
  items,
  pagination: { page: 1, limit: 500, total: items.length, totalPages: 1 },
})

const calendarOf = (expenses: Expense[] = [], incomes: Income[] = []) =>
  buildCalendarMonth(SEPTEMBER, page(expenses), page(incomes))

const renderGrid = (
  calendar = calendarOf(),
  props: Partial<Parameters<typeof MonthGrid>[0]> = {},
) =>
  renderWithProviders(
    <MonthGrid
      month={SEPTEMBER}
      calendar={calendar}
      selectedDate={null}
      today={TODAY}
      onSelect={() => {}}
      {...props}
    />,
  )

/** Anchored: an unanchored `/3 Sep/` also matches the 13th and the 23rd. */
const day = (name: RegExp) => screen.getByRole('gridcell', { name })

describe('MonthGrid', () => {
  it('draws every day of the month', () => {
    renderGrid()
    expect(screen.getAllByRole('gridcell')).toHaveLength(30)
  })

  it('states what a day holds in its accessible name', () => {
    renderGrid(calendarOf([expense('2026-09-03', 111000)]))
    expect(day(/^3 Sep/)).toHaveAccessibleName(/111\.000/)
  })

  it('says a past day with nothing on it recorded nothing', () => {
    renderGrid()
    expect(day(/^3 Sep/)).toHaveAccessibleName(/tidak ada catatan/i)
  })

  it('says a day that has not arrived has not arrived', () => {
    renderGrid()
    // A quiet day and a day that has not happened are different facts, and the
    // difference has to survive with the marks switched off.
    expect(day(/^20 Sep/)).toHaveAccessibleName(/belum berlalu/i)
    expect(day(/^20 Sep/)).not.toHaveAccessibleName(/tidak ada catatan/i)
  })

  it('keeps a transfer out of what the day received', () => {
    renderGrid(calendarOf([], [income('2026-09-03', 2000000, 'source-bsi')]))
    expect(day(/^3 Sep/)).toHaveAccessibleName(/pindah antar sumber/i)
    expect(day(/^3 Sep/)).not.toHaveAccessibleName(/masuk/i)
  })

  it('marks today', () => {
    renderGrid()
    expect(day(/^12 Sep/)).toHaveAttribute('data-today', 'true')
    expect(day(/^11 Sep/)).not.toHaveAttribute('data-today', 'true')
  })

  it('reports the selected day as selected', () => {
    renderGrid(calendarOf(), { selectedDate: '2026-09-08' })
    expect(day(/^8 Sep/)).toHaveAttribute('aria-selected', 'true')
  })

  it('opens a day when it is clicked', async () => {
    const onSelect = vi.fn()
    renderGrid(calendarOf(), { onSelect })

    await userEvent.click(day(/^9 Sep/))

    expect(onSelect).toHaveBeenCalledWith('2026-09-09')
  })

  it('walks the month with the arrow keys', async () => {
    renderGrid(calendarOf(), { selectedDate: '2026-09-08' })

    day(/^8 Sep/).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(day(/^9 Sep/)).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    expect(day(/^16 Sep/)).toHaveFocus()

    await userEvent.keyboard('{ArrowUp}')
    expect(day(/^9 Sep/)).toHaveFocus()
  })

  it('stays inside the month at its edges', async () => {
    renderGrid(calendarOf(), { selectedDate: '2026-09-01' })

    day(/^1 Sep/).focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(day(/^1 Sep/)).toHaveFocus()
  })

  it('keeps exactly one day in the tab order', () => {
    renderGrid(calendarOf(), { selectedDate: '2026-09-08' })
    const reachable = screen
      .getAllByRole('gridcell')
      .filter((cell) => cell.getAttribute('tabindex') === '0')
    expect(reachable).toHaveLength(1)
  })

  it('names each stream in words, so colour never carries the meaning alone', () => {
    renderGrid()
    expect(screen.getByText('Keluar')).toBeInTheDocument()
    expect(screen.getByText('Masuk')).toBeInTheDocument()
    expect(screen.getByText('Pindah antar sumber')).toBeInTheDocument()
  })

  it('states the scale it draws against', () => {
    renderGrid()
    expect(screen.getByText(/hari tersibuknya sendiri/i)).toBeInTheDocument()
  })
})
