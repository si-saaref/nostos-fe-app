import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { CategorySection } from '@/modules/settings/components/CategorySection'
import { MOCK_ME } from '@/mocks/fixtures/household'

describe('CategorySection archive copy', () => {
  it('does not claim a partial usage count is the full history', async () => {
    renderWithProviders(
      <CategorySection householdId={MOCK_ME.household_id} canManage />,
    )
    await screen.findByText('Belanja')
    expect(screen.queryByText(/Dipakai \d+ pengeluaran/)).toBeNull()
  })
})

/** The 409 names the row, and that wording is the feature. */
describe('CategorySection duplicate names', () => {
  it('renders the server 409 verbatim', async () => {
    renderWithProviders(
      <CategorySection householdId={MOCK_ME.household_id} canManage />,
    )
    await screen.findByText('Belanja')

    await userEvent.click(
      screen.getByRole('button', { name: /Tambah kategori/ }),
    )
    await userEvent.type(screen.getByLabelText('Nama kategori'), 'Belanja')
    await userEvent.click(screen.getByRole('button', { name: 'Tambah' }))

    expect(
      await screen.findByText('Kategori "Belanja" sudah ada'),
    ).toBeInTheDocument()
  })

  it('keeps a rejected rename and its draft open', async () => {
    renderWithProviders(
      <CategorySection householdId={MOCK_ME.household_id} canManage />,
    )
    await screen.findByText('Utilitas')

    await userEvent.click(screen.getByRole('button', { name: 'Utilitas' }))
    const input = screen.getByLabelText('Nama kategori')
    await userEvent.clear(input)
    await userEvent.type(input, 'Belanja')
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(
      await screen.findByText('Kategori "Belanja" sudah ada'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nama kategori')).toHaveValue('Belanja')
  })
})
