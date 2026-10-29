import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountSection } from '@/modules/settings/components/AccountSection'
import { db } from '@/mocks/db'
import { renderWithProviders } from '@/test/test-utils'

const renderSection = () =>
  renderWithProviders(<AccountSection householdId="household-001" canManage />)

describe('AccountSection', () => {
  it('offers exactly the two product account actions and seeds their kinds', async () => {
    renderSection()

    const cash = await screen.findByRole('button', { name: /tambah tunai/i })
    const bank = screen.getByRole('button', { name: /tambah akun bank/i })
    expect(
      screen.queryByRole('button', { name: /^\+? tambah akun$/i }),
    ).toBeNull()

    await userEvent.click(cash)
    expect(screen.queryByLabelText(/^jenis$/i)).toBeNull()
    await userEvent.type(
      screen.getByLabelText(/^nama akun$/i),
      'Dompet perjalanan',
    )
    await userEvent.click(screen.getByRole('button', { name: /^tambah$/i }))
    await waitFor(() =>
      expect(db.accounts.at(-1)).toMatchObject({
        name: 'Dompet perjalanan',
        kind: 'cash',
      }),
    )

    await userEvent.click(bank)
    await userEvent.type(
      screen.getByLabelText(/^nama akun$/i),
      'Rekening liburan',
    )
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
    await userEvent.click(
      await screen.findByRole('button', { name: /tambah tunai/i }),
    )
    await userEvent.click(screen.getByLabelText(/^tanggal mulai hitung$/i))

    expect(screen.getByRole('button', { name: /^hari ini$/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^kemarin$/i })).toBeEnabled()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowLabel = new Intl.DateTimeFormat('id', {
      dateStyle: 'full',
    }).format(tomorrow)
    expect(screen.getByRole('button', { name: tomorrowLabel })).toBeDisabled()
  })

  it('explains protected defaults and withholds archive while ordinary accounts can archive', async () => {
    renderSection()

    const protectedRow = (
      await screen.findByText('Tunai — kotak dapur')
    ).closest('article')!
    await userEvent.click(within(protectedRow).getByRole('button'))
    await userEvent.click(
      within(protectedRow).getByRole('button', { name: /^bawaan$/i }),
    )
    expect(screen.getByRole('dialog')).toHaveTextContent(/akun bawaan/i)
    await userEvent.keyboard('{Escape}')
    expect(
      within(protectedRow).queryByRole('button', { name: /arsipkan/i }),
    ).toBeNull()
    expect(within(protectedRow).queryByLabelText(/^jenis$/i)).toBeNull()

    const ordinaryRow = screen.getByText('QRIS').closest('article')!
    await userEvent.click(within(ordinaryRow).getByRole('button'))
    expect(
      within(ordinaryRow).getByRole('button', { name: /arsipkan/i }),
    ).toBeInTheDocument()
  })
})

it('offers one-time start assignment only from BE eligibility and explains the baseline', async () => {
  db.accounts[0].calculationStartCanSet = true
  renderSection()
  const row = (await screen.findByText(db.accounts[0].name)).closest('article')!
  await userEvent.click(within(row).getByRole('button'))
  expect(
    within(row).getByRole('button', { name: /tetapkan saldo awal/i }),
  ).toBeInTheDocument()
  await userEvent.type(within(row).getByLabelText(/^saldo awal$/i), '0')
  await userEvent.click(
    within(row).getByRole('button', { name: /tetapkan saldo awal/i }),
  )
  expect(screen.getByRole('dialog')).toHaveTextContent(/sekali/i)
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: /tetapkan saldo awal/i,
    }),
  )
  await waitFor(() => expect(db.accounts[0].calculationStartCanSet).toBe(false))
})

it('keeps the account row open after Escape closes protected-account help', async () => {
  renderSection()
  const row = (await screen.findByText(db.accounts[0].name)).closest('article')!
  const trigger = within(row).getByRole('button')
  await userEvent.click(trigger)
  const help = within(row).getByRole('button', { name: /^bawaan$/i })
  await userEvent.click(help)
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  expect(help).toHaveFocus()
})

it('labels current BE balance and its date independently of opening metadata', async () => {
  const { http, HttpResponse } = await import('msw')
  const { server } = await import('@/mocks/server')
  server.use(
    http.get('*/positions', () =>
      HttpResponse.json({
        success: true,
        data: [
          {
            source_id: db.accounts[0].id,
            opening_balance: '5000.00',
            balance: '72000.00',
          },
        ],
        meta: {
          summary: {
            total_balance: '72000.00',
            currency: 'IDR',
            as_of: '2026-10-29',
          },
        },
      }),
    ),
  )
  renderSection()
  const row = (await screen.findByText(db.accounts[0].name)).closest('article')!
  expect(
    await within(row).findByText(/saldo sekarang.*2026-10-29/i),
  ).toBeInTheDocument()
  expect(row).toHaveTextContent('72.000')
})
