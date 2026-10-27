import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountSection } from '@/modules/settings/components/AccountSection'
import { db } from '@/mocks/db'
import { renderWithProviders } from '@/test/test-utils'

const renderSection = () =>
  renderWithProviders(
    <AccountSection householdId="household-001" canManage />,
  )

describe('AccountSection', () => {
  it('offers exactly the two product account actions and seeds their kinds', async () => {
    renderSection()

    const cash = await screen.findByRole('button', { name: /tambah tunai/i })
    const bank = screen.getByRole('button', { name: /tambah akun bank/i })
    expect(screen.queryByRole('button', { name: /^\+? tambah akun$/i })).toBeNull()

    await userEvent.click(cash)
    expect(screen.queryByLabelText(/^jenis$/i)).toBeNull()
    await userEvent.type(screen.getByLabelText(/^nama akun$/i), 'Dompet perjalanan')
    await userEvent.click(screen.getByRole('button', { name: /^tambah$/i }))
    await waitFor(() =>
      expect(db.accounts.at(-1)).toMatchObject({
        name: 'Dompet perjalanan',
        kind: 'cash',
      }),
    )

    await userEvent.click(bank)
    await userEvent.type(screen.getByLabelText(/^nama akun$/i), 'Rekening liburan')
    await userEvent.click(screen.getByRole('button', { name: /^tambah$/i }))
    await waitFor(() =>
      expect(db.accounts.at(-1)).toMatchObject({
        name: 'Rekening liburan',
        kind: 'bank',
      }),
    )
  })

  it('allows today and past opening dates but disables future dates', async () => {
    renderSection()
    await userEvent.click(await screen.findByRole('button', { name: /tambah tunai/i }))
    await userEvent.click(screen.getByLabelText(/^tanggal mulai hitung$/i))

    expect(screen.getByRole('button', { name: /^hari ini$/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^kemarin$/i })).toBeEnabled()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowLabel = new Intl.DateTimeFormat('id', { dateStyle: 'full' })
      .format(tomorrow)
    expect(screen.getByRole('button', { name: tomorrowLabel })).toBeDisabled()
  })

  it('explains protected defaults and withholds archive while ordinary accounts can archive', async () => {
    renderSection()

    const protectedRow = (await screen.findByText('Tunai — kotak dapur'))
      .closest('article')!
    await userEvent.click(within(protectedRow).getByRole('button'))
    expect(within(protectedRow).getByText(/akun bawaan/i)).toBeInTheDocument()
    expect(within(protectedRow).queryByRole('button', { name: /arsipkan/i }))
      .toBeNull()
    expect(within(protectedRow).queryByLabelText(/^jenis$/i)).toBeNull()

    const ordinaryRow = screen.getByText('QRIS').closest('article')!
    await userEvent.click(within(ordinaryRow).getByRole('button'))
    expect(within(ordinaryRow).getByRole('button', { name: /arsipkan/i }))
      .toBeInTheDocument()
  })
})
