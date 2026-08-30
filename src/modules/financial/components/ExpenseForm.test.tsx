import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { chooseOption, renderWithProviders } from '@/test/test-utils'
import { ExpenseForm } from '@/modules/financial/components/ExpenseForm'

describe('ExpenseForm', () => {
  it('lets members add expenses — create is not an admin-only action', () => {
    renderWithProviders(<ExpenseForm />, { household: { role: 'member' } })
    expect(screen.getByRole('button', { name: /catat/i })).toBeInTheDocument()
  })

  it('submits a valid expense and calls onSuccess', async () => {
    const onSuccess = vi.fn()
    renderWithProviders(<ExpenseForm onSuccess={onSuccess} />)

    await userEvent.type(screen.getByLabelText(/nama pengeluaran/i), 'Kopi')
    await userEvent.type(screen.getByLabelText(/jumlah/i), '25000')
    await chooseOption(/kategori/i, 'Belanja')
    await chooseOption(/metode pembayaran/i, /^Tunai/)
    await userEvent.click(screen.getByRole('button', { name: /catat/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })

  it('blocks an empty submission with field errors', async () => {
    renderWithProviders(<ExpenseForm />)
    await userEvent.click(screen.getByRole('button', { name: /catat/i }))

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts.map((alert) => alert.textContent).join(' ')).toMatch(/wajib/i)
  })

  it('rejects a future date', async () => {
    renderWithProviders(<ExpenseForm />)
    const future = new Date()
    future.setDate(future.getDate() + 3)
    const iso = future.toISOString().slice(0, 10)

    await userEvent.type(screen.getByLabelText(/nama pengeluaran/i), 'Kopi')
    await userEvent.type(screen.getByLabelText(/jumlah/i), '25000')
    await chooseOption(/kategori/i, 'Belanja')
    await chooseOption(/metode pembayaran/i, /^Tunai/)
    // Native validation would silently swallow this submit without noValidate,
    // so this test also guards that the form owns its own rules.
    fireEvent.change(screen.getByLabelText(/tanggal bayar/i), {
      target: { value: iso },
    })
    await userEvent.click(screen.getByRole('button', { name: /catat/i }))

    expect(
      await screen.findByText(/tidak boleh tanggal yang akan datang/i),
    ).toBeInTheDocument()
  })
})
