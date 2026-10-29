import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { ExpenseFilter } from './ExpenseFilter'

it('stages mobile filters and only commits on Apply', async () => {
  const changed = vi.fn()
  renderWithProviders(
    <ExpenseFilter
      householdId="household-001"
      filters={{ page: 1, limit: 400, sortBy: 'datePaid', sortOrder: 'desc' }}
      onChange={changed}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: /^filter/i }))
  const sheet = screen.getByRole('dialog')
  const category = within(sheet).getByRole('combobox', { name: /kategori/i })
  await userEvent.click(category)
  const option = (await screen.findAllByRole('option'))[1]
  await userEvent.click(option)
  expect(changed).not.toHaveBeenCalled()
  await userEvent.click(
    within(sheet).getByRole('button', { name: /terapkan/i }),
  )
  expect(changed).toHaveBeenCalledOnce()
  expect(changed.mock.calls[0][0].typeId).toBeTruthy()
})
