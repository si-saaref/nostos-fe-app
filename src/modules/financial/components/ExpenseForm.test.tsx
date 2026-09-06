import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { chooseOption, renderWithProviders } from '@/test/test-utils'
import { Role } from '@/types/household'
import { ExpenseForm } from '@/modules/financial/components/ExpenseForm'

describe('ExpenseForm', () => {
  it('lets members add expenses — create is not an admin-only action', () => {
    renderWithProviders(<ExpenseForm />, { household: { role: Role.MEMBER } })
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

  // A required Select used to block the submit and render nothing, so the
  // button simply appeared broken.
  it('explains a missing category instead of silently refusing to submit', async () => {
    const onSuccess = vi.fn()
    renderWithProviders(<ExpenseForm onSuccess={onSuccess} />)

    await userEvent.type(screen.getByLabelText(/nama pengeluaran/i), 'Kopi')
    await userEvent.type(screen.getByLabelText(/jumlah/i), '25000')
    await chooseOption(/metode pembayaran/i, /^Tunai/)
    await userEvent.click(screen.getByRole('button', { name: /catat/i }))

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.map((alert) => alert.textContent).join(' ')).toMatch(
      /kategori/i,
    )
    expect(onSuccess).not.toHaveBeenCalled()
  })

  /** A 422 with a code and no details[] — the shape deviation #1 describes. */
  const rejectWith = (code: string, message: string) => {
    server.use(
      http.post('*/api/v1/expenses', () =>
        HttpResponse.json(
          { success: false, error: { code, message, status_code: 422 } },
          { status: 422 },
        ),
      ),
    )
  }

  const fillValidForm = async () => {
    await userEvent.type(screen.getByLabelText(/nama pengeluaran/i), 'Kopi')
    await userEvent.type(screen.getByLabelText(/jumlah/i), '25000')
    await chooseOption(/kategori/i, 'Belanja')
    await chooseOption(/metode pembayaran/i, /^Tunai/)
  }

  /**
   * `aria-invalid` on the combobox is what separates a field error from a
   * summary line: both render the same text, only one marks the control. The
   * other two Selects staying clean is the other half of the claim.
   */
  const expectOnlyInvalid = (invalid: RegExp) => {
    const fields = [/kategori/i, /metode pembayaran/i, /dibayar oleh/i]
    fields.forEach((name) => {
      const combobox = screen.getByRole('combobox', { name })
      if (name.source === invalid.source) {
        expect(combobox).toHaveAttribute('aria-invalid', 'true')
      } else {
        expect(combobox).not.toHaveAttribute('aria-invalid')
      }
    })
  }

  it('puts a rejected category on the category field, not in a generic toast', async () => {
    rejectWith('INVALID_TYPE', 'Kategori tidak ditemukan')
    renderWithProviders(<ExpenseForm />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: /catat/i }))

    expect(
      await screen.findByText('Kategori tidak ditemukan'),
    ).toBeInTheDocument()
    expectOnlyInvalid(/kategori/i)
    // Once, not twice: the summary line stands down when a field claimed it.
    expect(screen.getAllByText('Kategori tidak ditemukan')).toHaveLength(1)
  })

  it('puts a rejected payment method on the method field', async () => {
    rejectWith('INVALID_SOURCE', 'Metode pembayaran tidak ditemukan')
    renderWithProviders(<ExpenseForm />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: /catat/i }))

    expect(
      await screen.findByText('Metode pembayaran tidak ditemukan'),
    ).toBeInTheDocument()
    expectOnlyInvalid(/metode pembayaran/i)
  })

  it('puts a rejected payer on the paid-by field', async () => {
    rejectWith('INVALID_USER', 'Anggota tidak ditemukan')
    renderWithProviders(<ExpenseForm />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: /catat/i }))

    expect(
      await screen.findByText('Anggota tidak ditemukan'),
    ).toBeInTheDocument()
    expectOnlyInvalid(/dibayar oleh/i)
  })

  it('clears a server field error when the member changes that field', async () => {
    rejectWith('INVALID_TYPE', 'Kategori tidak ditemukan')
    renderWithProviders(<ExpenseForm />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: /catat/i }))
    await screen.findByText('Kategori tidak ditemukan')

    await chooseOption(/kategori/i, 'Transport')

    await waitFor(() =>
      expect(
        screen.queryByText('Kategori tidak ditemukan'),
      ).not.toBeInTheDocument(),
    )
  })

  // An error nothing can be pinned on must still be visible.
  it('falls back to the summary line for an unmapped error', async () => {
    rejectWith('RATE_LIMITED', 'Terlalu banyak permintaan')
    renderWithProviders(<ExpenseForm />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: /catat/i }))

    expect(
      await screen.findByText('Terlalu banyak permintaan'),
    ).toBeInTheDocument()
  })
})
