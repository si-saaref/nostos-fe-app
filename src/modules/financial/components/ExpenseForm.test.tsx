import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { ExpenseForm } from '@/modules/financial/components/ExpenseForm'

describe('ExpenseForm', () => {
  it('blocks members from adding expenses', () => {
    renderWithProviders(<ExpenseForm />, { household: { role: 'member' } })
    expect(screen.getByText(/only admins can add expenses/i)).toBeInTheDocument()
  })

  it('submits a valid expense and calls onSuccess', async () => {
    const onSuccess = vi.fn()
    renderWithProviders(<ExpenseForm onSuccess={onSuccess} />)

    // Wait for type/source options (from MSW) to load.
    await screen.findByRole('option', { name: 'Groceries' })

    await userEvent.type(screen.getByLabelText(/name/i), 'Coffee')
    await userEvent.type(screen.getByLabelText(/amount/i), '25000')
    await userEvent.selectOptions(screen.getByLabelText(/type/i), 'type-groceries')
    await userEvent.selectOptions(screen.getByLabelText(/source/i), 'source-cash')
    await userEvent.click(screen.getByRole('button', { name: /add expense/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })
})
