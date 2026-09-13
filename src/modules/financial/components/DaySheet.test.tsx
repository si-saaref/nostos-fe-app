import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '@/test/test-utils'
import { DaySheet } from '@/modules/financial/components/DaySheet'
import type { CalendarDay } from '@/modules/financial/lib/calendarMonth'
import type { Expense } from '@/types/expense'
import type { Income } from '@/types/income'

const expense = (value: number, name = 'Sayur & buah pasar'): Expense => ({
  id: `e-${value}`,
  name,
  value,
  typeId: 'type-belanja',
  sourceId: 'source-tunai',
  datePaid: '2026-09-12',
  paidByUserId: 'user-1',
  householdId: 'h1',
})

const incomeRow = (
  amount: number,
  fromSourceId: string | null,
  name = 'Gaji',
): Income => ({
  id: `i-${amount}`,
  name,
  amount,
  typeId: 'itype-0',
  fromSourceId,
  toSourceId: 'source-bni',
  date: '2026-09-12',
  householdId: 'h1',
})

const dayOf = (partial: Partial<CalendarDay> = {}): CalendarDay => ({
  date: '2026-09-12',
  spent: 0,
  inflow: 0,
  moved: 0,
  expenses: [],
  income: [],
  count: 0,
  ...partial,
})

const NAMES: Record<string, string> = {
  'type-belanja': 'Belanja',
  'source-tunai': 'Tunai — kotak dapur',
  'source-bni': 'BNI',
  'user-1': 'Alex Smith',
  'itype-0': 'gaji',
  'itype-3': 'tarik tunai',
}

const renderSheet = (
  day: CalendarDay | null,
  props: Partial<Parameters<typeof DaySheet>[0]> = {},
) =>
  renderWithProviders(
    <DaySheet
      day={day}
      today="2026-09-12"
      nameOf={(id) => NAMES[id] ?? '—'}
      rimOf={() => 1}
      {...props}
    />,
  )

describe('DaySheet', () => {
  it('asks for a day when none is open', () => {
    renderSheet(null)
    expect(screen.getByText(/pilih satu hari/i)).toBeInTheDocument()
  })

  it('names the day, and says when it is today', () => {
    renderSheet(dayOf())
    expect(screen.getByText(/12 September/)).toBeInTheDocument()
    expect(screen.getByText(/^Hari ini ·/)).toBeInTheDocument()
  })

  it('does not call another day today', () => {
    renderSheet(dayOf({ date: '2026-09-09' }), { today: '2026-09-12' })
    expect(screen.queryByText(/hari ini/i)).not.toBeInTheDocument()
  })

  it('says plainly when a day holds nothing', () => {
    renderSheet(dayOf())
    expect(
      screen.getByText(/tidak ada yang dicatat pada tanggal ini/i),
    ).toBeInTheDocument()
  })

  it('dashes a stream the day had none of, rather than printing a zero', () => {
    renderSheet(dayOf({ spent: 87000, expenses: [expense(87000)], count: 1 }))
    const figures = screen.getByRole('group', { name: /12 September/ })
    // A zero here would be a claim that nothing arrived; the truth is that
    // nothing arrived *and* nothing was expected to.
    expect(within(figures).getAllByText('—')).toHaveLength(2)
  })

  it('lists an expense with its category, source and payer', () => {
    renderSheet(dayOf({ spent: 87000, expenses: [expense(87000)], count: 1 }))
    const row = screen.getByRole('listitem')
    expect(within(row).getByText('Sayur & buah pasar')).toBeInTheDocument()
    expect(row).toHaveTextContent('Belanja')
    expect(row).toHaveTextContent('Tunai — kotak dapur')
    expect(row).toHaveTextContent('Alex Smith')
  })

  it('signs an external inflow and leaves a transfer unsigned', () => {
    renderSheet(
      dayOf({
        inflow: 8500000,
        moved: 1000000,
        income: [
          incomeRow(8500000, null),
          incomeRow(1000000, 'source-tunai', 'Setoran ke BNI'),
        ],
        count: 2,
      }),
    )

    const rows = screen.getAllByRole('listitem')
    const salary = rows.find((row) => row.textContent?.includes('Gaji'))
    const transfer = rows.find((row) =>
      row.textContent?.includes('Setoran ke BNI'),
    )

    expect(salary).toHaveTextContent(/\+\s?Rp/)
    // A `+` in front of a withdrawal is a wrong number, not a styling choice.
    expect(transfer).not.toHaveTextContent(/\+/)
  })

  it('shows a transfer as a route between two of the household own sources', () => {
    renderSheet(
      dayOf({
        moved: 1000000,
        income: [incomeRow(1000000, 'source-tunai', 'Setoran ke BNI')],
        count: 1,
      }),
    )
    const row = screen.getByRole('listitem')
    expect(row).toHaveTextContent('Tunai — kotak dapur')
    expect(row).toHaveTextContent('BNI')
  })

  it('marks money from outside the household as external', () => {
    renderSheet(
      dayOf({ inflow: 500000, income: [incomeRow(500000, null)], count: 1 }),
    )
    expect(screen.getByRole('listitem')).toHaveTextContent(/dari luar/i)
  })

  it('leads with the largest movement of the day', () => {
    renderSheet(
      dayOf({
        spent: 267000,
        inflow: 8500000,
        expenses: [expense(180000, 'Nasi padang'), expense(87000)],
        income: [incomeRow(8500000, null)],
        count: 3,
      }),
    )
    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Gaji')
    expect(rows[1]).toHaveTextContent('Nasi padang')
    expect(rows[2]).toHaveTextContent('Sayur & buah pasar')
  })

  it('names the kind of every row, because the rim names its category', () => {
    renderSheet(
      dayOf({
        spent: 50000,
        inflow: 1500000,
        moved: 140000,
        expenses: [expense(50000, 'Ayam bakar')],
        income: [
          incomeRow(1500000, null, 'Gajian kecil'),
          incomeRow(140000, 'source-tunai', 'TT Bos'),
        ],
        count: 3,
      }),
    )

    const rows = screen.getAllByRole('listitem')
    const kindOf = (name: string) =>
      rows.find((row) => row.textContent?.includes(name))

    expect(kindOf('Gajian kecil')).toHaveTextContent('Pemasukan')
    expect(kindOf('TT Bos')).toHaveTextContent('Pemindahan')
    expect(kindOf('Ayam bakar')).toHaveTextContent('Pengeluaran')
  })

  it('signs an expense out and an inflow in, and leaves a transfer unsigned', () => {
    renderSheet(
      dayOf({
        spent: 50000,
        inflow: 1500000,
        moved: 140000,
        expenses: [expense(50000, 'Ayam bakar')],
        income: [
          incomeRow(1500000, null, 'Gajian kecil'),
          incomeRow(140000, 'source-tunai', 'TT Bos'),
        ],
        count: 3,
      }),
    )

    const rows = screen.getAllByRole('listitem')
    const rowFor = (name: string) =>
      rows.find((row) => row.textContent?.includes(name))

    // On a page mixing both ledgers an unsigned amount is ambiguous, so the
    // two directed kinds take a sign. The transfer keeps none: it has no
    // direction the household as a whole could read one from.
    expect(rowFor('Ayam bakar')).toHaveTextContent(/−\s?IDR|−\s?Rp/)
    expect(rowFor('Gajian kecil')).toHaveTextContent(/\+\s?IDR|\+\s?Rp/)
    expect(rowFor('TT Bos')).not.toHaveTextContent(/[−+]/)
  })

  it('says where entries are changed, because they are not changed here', () => {
    renderSheet(dayOf({ spent: 87000, expenses: [expense(87000)], count: 1 }))
    expect(screen.getByText(/hanya untuk dibaca/i)).toBeInTheDocument()
  })

  it('offers no control that would change an entry', () => {
    renderSheet(dayOf({ spent: 87000, expenses: [expense(87000)], count: 1 }))
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
