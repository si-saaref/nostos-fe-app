import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { MonthRail } from './MonthRail'
import { ExpenseFilter } from './ExpenseFilter'

it('keeps the rail descending and jumps to the same tape date', async () => {
  const onJump = vi.fn()
  renderWithProviders(
    <MonthRail
      days={[
        { date: '2026-10-03', total: 30, count: 1 },
        { date: '2026-10-01', total: 10, count: 1 },
      ]}
      rangeFrom="2026-10-01"
      rangeTo="2026-10-03"
      activeDate="2026-10-01"
      onJump={onJump}
      cumulative={40}
      monthTotal={40}
    />,
  )
  const buttons = screen.getAllByRole('button')
  expect(buttons[0].getAttribute('aria-label')).toMatch(/3/)
  await userEvent.click(buttons[0])
  expect(onJump).toHaveBeenCalledWith('2026-10-03')
})
it('gives keyboard search a single composite focus indicator', async () => {
  renderWithProviders(
    <ExpenseFilter
      householdId="household-001"
      filters={{ page: 1, limit: 25, sortBy: 'datePaid', sortOrder: 'desc' }}
      onChange={() => {}}
    />,
  )
  const input = screen.getByRole('searchbox')
  await userEvent.tab()
  expect(input).toHaveFocus()
  expect(input).toHaveClass('focus-visible:outline-none')
  expect(input.closest('label')).toHaveClass('focus-within:ring-2')
})
