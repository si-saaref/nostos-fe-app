import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountSection } from '@/modules/settings/components/AccountSection'
import { db } from '@/mocks/db'
import { renderWithProviders } from '@/test/test-utils'

const renderSection = () =>
  renderWithProviders(<AccountSection householdId="household-001" canManage />)

describe('AccountSection', () => {
  it.each([
    ['Tunai', 'cash', 'Dompet perjalanan'],
    ['Bank', 'bank', 'Rekening liburan'],
  ])(
    'creates a named %s account from the unified action',
    async (label, kind, name) => {
      renderSection()
      await userEvent.click(
        await screen.findByRole('button', { name: /^\+? tambah akun$/i }),
      )
      await userEvent.click(screen.getByRole('radio', { name: label }))
      await userEvent.type(screen.getByLabelText(/^nama akun$/i), name)
      await userEvent.click(screen.getByRole('button', { name: /^tambah$/i }))
      await waitFor(() =>
        expect(db.accounts.at(-1)).toMatchObject({
          name,
          kind,
          baselineStatus: 'UNVERIFIED',
          calculationStartCanSet: true,
        }),
      )
      expect(
        await screen.findByRole('button', { name: /tetapkan saldo awal/i }),
      ).toBeInTheDocument()
    },
  )

  it('explains protected defaults and withholds archive while ordinary accounts can archive', async () => {
    renderSection()

    const protectedRow = (
      await screen.findByText('Tunai — kotak dapur')
    ).closest('article')!
    await userEvent.click(
      within(protectedRow).getByRole('button', {
        expanded: false,
        name: /kotak dapur/i,
      }),
    )
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
    await userEvent.click(
      within(ordinaryRow).getByRole('button', { expanded: false }),
    )
    expect(
      within(ordinaryRow).getByRole('button', { name: /arsipkan/i }),
    ).toBeInTheDocument()
  })
})

it('offers one-time start assignment only from BE eligibility and explains the baseline', async () => {
  db.accounts[0].calculationStartCanSet = true
  renderSection()
  const row = (await screen.findByText(db.accounts[0].name)).closest('article')!
  await userEvent.click(
    within(row).getByRole('button', { expanded: false, name: /kotak dapur/i }),
  )
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
  const trigger = within(row).getByRole('button', {
    expanded: false,
    name: /kotak dapur/i,
  })
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
  expect(await within(row).findByText(/29 Okt 2026/i)).toBeInTheDocument()
  expect(row).toHaveTextContent('72.000')
})

it('edits the account name directly after expanding', async () => {
  renderSection()
  const row = (await screen.findByText(db.accounts[0].name)).closest('article')!
  await userEvent.click(
    within(row).getByRole('button', { expanded: false, name: /kotak dapur/i }),
  )
  const input = within(row).getByLabelText(/^nama akun$/i)
  await userEvent.clear(input)
  await userEvent.type(input, 'Dompet utama')
  await userEvent.click(within(row).getByRole('button', { name: /^simpan$/i }))
  await waitFor(() => expect(db.accounts[0].name).toBe('Dompet utama'))
})

it('renders Default as a text-only help trigger outside the account disclosure button', async () => {
  renderSection()
  const row = (await screen.findByText(db.accounts[0].name)).closest('article')!
  const badge = within(row).getByRole('button', { name: /^bawaan$/i })
  expect(badge).toHaveTextContent('Bawaan')
  expect(badge.querySelector('svg')).toBeNull()
  expect(row.querySelector('button button')).toBeNull()
})

it('shows Default help on hover without expanding the account', async () => {
  const user = userEvent.setup()
  renderSection()
  const row = (await screen.findByText(db.accounts[0].name)).closest('article')!
  const disclosure = within(row).getByRole('button', { name: /kotak dapur/i })
  const badge = within(row).getByRole('button', { name: /^bawaan$/i })
  await user.hover(badge)
  expect(await screen.findByRole('dialog')).toHaveTextContent(/akun bawaan/i)
  expect(disclosure).toHaveAttribute('aria-expanded', 'false')
  await user.unhover(badge)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

it('toggles Default help on touch without toggling the account', async () => {
  const user = userEvent.setup()
  renderSection()
  const row = (await screen.findByText(db.accounts[0].name)).closest('article')!
  const disclosure = within(row).getByRole('button', { name: /kotak dapur/i })
  const badge = within(row).getByRole('button', { name: /^bawaan$/i })
  await user.pointer([
    { keys: '[TouchA>]', target: badge },
    { keys: '[/TouchA]' },
  ])
  expect(await screen.findByRole('dialog')).toHaveTextContent(/akun bawaan/i)
  expect(disclosure).toHaveAttribute('aria-expanded', 'false')
  await user.pointer([
    { keys: '[TouchA>]', target: badge },
    { keys: '[/TouchA]' },
  ])
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(disclosure).toHaveAttribute('aria-expanded', 'false')
})

it('supports keyboard disclosure and opens Default help when the badge receives focus', async () => {
  const user = userEvent.setup()
  renderSection()
  const row = (await screen.findByText(db.accounts[0].name)).closest('article')!
  const disclosure = within(row).getByRole('button', { name: /kotak dapur/i })
  await user.click(disclosure)
  await user.keyboard(' ')
  expect(disclosure).toHaveAttribute('aria-expanded', 'false')
  await user.keyboard('{Enter}')
  expect(disclosure).toHaveAttribute('aria-expanded', 'true')
  await user.tab()
  expect(within(row).getByRole('button', { name: /^bawaan$/i })).toHaveFocus()
  expect(await screen.findByRole('dialog')).toHaveTextContent(/akun bawaan/i)
})
