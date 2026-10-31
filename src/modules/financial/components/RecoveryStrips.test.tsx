import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '@/test/test-utils'
import { CountStrip } from './CountStrip'
import { InflowStrip } from './InflowStrip'
const total = { sum: 100, sumText: '100.00', count: 5, average: 20 }
const common = {
  householdId: 'household-001',
  month: new Date(2026, 8, 1),
  onStepMonth: () => {},
  onSelectMonth: () => {},
  canStepForward: true,
  listLoaded: true,
  totals: total,
}
it('states current balance, selected expense total, explicit transaction count and allocation', async () => {
  renderWithProviders(
    <CountStrip
      {...common}
      filters={{ page: 1, limit: 400, sortBy: 'datePaid', sortOrder: 'desc' }}
      summary={{
        current: total,
        previous: total,
        comparison: { percentage: '0.0', direction: 'flat' },
      }}
      scopes={[]}
      onRemoveScope={() => {}}
      slice={null}
    />,
  )
  const region = screen.getByRole('region', { name: /hitungan/i })
  expect(within(region).getByText(/sisa saldo total/i)).toBeInTheDocument()
  expect(within(region).getByText(/^transaksi$/i)).toBeInTheDocument()
  expect(within(region).getByText(/5 pengeluaran/i)).toBeInTheDocument()
  expect(within(region).getByText(/0%/)).toBeInTheDocument()
  expect(within(region).queryByText(/rata-rata|per hari/i)).toBeNull()
})
it('removes income opening stock and shows canonical cash withdrawal even on a partial page', () => {
  renderWithProviders(
    <InflowStrip
      {...common}
      previousMonth={{ from: '2026-08-01', to: '2026-08-31' }}
      hasOpening={true}
      opening={500}
      figures={{
        moved: 300,
        transferCount: 4,
        externalCount: 1,
        isComplete: true,
      }}
      summary={{
        current: {
          ...total,
          cash_withdrawn: 120,
          cashWithdrawnText: '120.00',
          cash_withdrawal_count: 2,
        },
        previous: total,
        comparison: { percentage: '0.0', direction: 'flat' },
      }}
    />,
  )
  expect(screen.getByText(/tarik tunai/i)).toHaveTextContent('120')
  expect(screen.getByText('0%')).toBeInTheDocument()
  expect(screen.queryByText(/saldo awal/i)).toBeNull()
})

it.each([
  ['20.0', 'up', '▲ +20%'],
  ['-100.0', 'down', '▼ −100%'],
  ['0.0', 'flat', '0%'],
  [null, 'unavailable', '—'],
] as const)(
  'renders the BE comparison %s truthfully for income',
  (percentage, direction, label) => {
    renderWithProviders(
      <InflowStrip
        {...common}
        previousMonth={{ from: '2026-08-01', to: '2026-08-31' }}
        hasOpening={false}
        figures={{
          moved: null,
          externalCount: null,
          transferCount: null,
          isComplete: false,
        }}
        summary={{
          current: total,
          previous: total,
          comparison: { percentage, direction },
        }}
      />,
    )
    expect(screen.getAllByText(label).length).toBeGreaterThan(0)
  },
)
