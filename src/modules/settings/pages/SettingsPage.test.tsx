import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { SettingsPage } from '@/modules/settings/pages/SettingsPage'
import { renderWithProviders } from '@/test/test-utils'
import { Role } from '@/types/household'

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly scrollMargin = ''
  readonly thresholds = []
  disconnect = vi.fn()
  observe = vi.fn()
  takeRecords = vi.fn(() => [])
  unobserve = vi.fn()
}

vi.stubGlobal('IntersectionObserver', TestIntersectionObserver)

const LocationProbe = () => {
  const location = useLocation()
  return <output data-testid="location">{location.hash}</output>
}

const renderPage = (
  hash = '#akun',
  role: Role = Role.ADMIN,
) =>
  renderWithProviders(
    <>
      <SettingsPage />
      <LocationProbe />
    </>,
    { initialEntries: [`/settings${hash}`], household: { role } },
  )

describe('SettingsPage ownership navigation', () => {
  it('offers only Household Settings and My Account as top-level scopes', () => {
    renderPage()

    expect(
      screen.getAllByRole('button', { name: 'Pengaturan Rumah Tangga' }),
    ).toHaveLength(2)
    expect(
      screen.getAllByRole('button', { name: 'Akun Saya' }),
    ).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Pengeluaran' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pemasukan' })).toBeNull()
  })

  it('keeps a category deep link inside Household Settings and reports it active', () => {
    renderPage('#kategori-pengeluaran')

    expect(screen.getByRole('heading', { name: 'Kategori pengeluaran' }))
      .toBeInTheDocument()
    expect(
      screen
        .getAllByRole('button', { name: 'Kategori pengeluaran' })
        .every((button) => button.getAttribute('aria-current') === 'true'),
    ).toBe(true)
  })

  it('navigates My Account to the first account-owned section', async () => {
    renderPage()

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Akun Saya' })[0],
    )

    expect(screen.getByTestId('location')).toHaveTextContent('#ubah-nama')
    expect(screen.getByRole('heading', { name: 'Ubah nama' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ubah email' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Preferensi pribadi' }))
      .toBeInTheDocument()
  })

  it('keeps shared sections visible to a member without staging admin actions', () => {
    renderPage('#akun', Role.MEMBER)

    expect(screen.getByRole('heading', { name: 'Akun' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Anggota' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kategori pengeluaran' }))
      .toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kategori pemasukan' }))
      .toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /tambah akun/i })).toBeNull()
    expect(screen.getAllByText(/hanya admin/i).length).toBeGreaterThan(0)
  })
})
