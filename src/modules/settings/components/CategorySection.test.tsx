import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { CategorySection } from '@/modules/settings/components/CategorySection'
import { MOCK_ME } from '@/mocks/fixtures/household'

/**
 * `limit` is capped at 500, and a rejected count renders as zero rather than as
 * an error — so only the rendered count catches it.
 */
describe('CategorySection usage counts', () => {
  it('counts the expenses using a category', async () => {
    renderWithProviders(
      <CategorySection householdId={MOCK_ME.household_id} canManage />,
    )
    expect(
      await screen.findAllByText(/Dipakai \d+ pengeluaran/),
    ).not.toHaveLength(0)
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
})
