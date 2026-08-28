import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { ExpenseForm } from '@/modules/financial/components/ExpenseForm'

describe('ExpenseForm', () => {
  it('lets members add expenses — create is not an admin-only action', () => {
    renderWithProviders(<ExpenseForm />, { household: { role: 'member' } })
    expect(screen.getByRole('button', { name: /catat/i })).toBeInTheDocument()
  })

  it('submits a valid expense and calls onSuccess', async () => {
    const onSuccess = vi.fn()
    renderWithProviders(<ExpenseForm onSuccess={onSuccess} />)

    // Wait for category/method options (from MSW) to load.
    await screen.findByRole('option', { name: 'Belanja' })

    await userEvent.type(screen.getByLabelText(/nama pengeluaran/i), 'Kopi')
    await userEvent.type(screen.getByLabelText(/jumlah/i), '25000')
    await userEvent.selectOptions(
      screen.getByLabelText(/kategori/i),
      'type-belanja',
    )
    await userEvent.selectOptions(
      screen.getByLabelText(/metode pembayaran/i),
      'source-tunai',
    )
    await userEvent.click(screen.getByRole('button', { name: /catat/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })

  it('blocks an empty submission with field errors', async () => {
    renderWithProviders(<ExpenseForm />)
    await screen.findByRole('option', { name: 'Belanja' })

    await userEvent.click(screen.getByRole('button', { name: /catat/i }))

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts.map((alert) => alert.textContent).join(' ')).toMatch(/wajib/i)
  })
})
