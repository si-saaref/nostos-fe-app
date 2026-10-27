import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { AccountSection } from '@/modules/settings/components/AccountSection'
import { CategorySection } from '@/modules/settings/components/CategorySection'
import { ChangeEmailSection } from '@/modules/settings/components/ChangeEmailSection'
import { ChangeNameSection } from '@/modules/settings/components/ChangeNameSection'
import { SettingsPage } from '@/modules/settings/pages/SettingsPage'
import { server } from '@/mocks/server'
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

describe('Settings accessibility contract', () => {
  it('keeps direct account actions first in keyboard focus order', async () => {
    renderWithProviders(
      <AccountSection householdId="household-001" canManage />,
    )
    const cash = await screen.findByRole('button', { name: /tambah tunai/i })
    const bank = screen.getByRole('button', { name: /tambah akun bank/i })

    await userEvent.tab()
    expect(cash).toHaveFocus()
    await userEvent.tab()
    expect(bank).toHaveFocus()
  })

  it('gives every mobile settings navigation target a 44px minimum hit area', () => {
    renderWithProviders(<SettingsPage />)

    for (const button of [
      ...screen.getAllByRole('button', { name: 'Pengaturan Rumah Tangga' }),
      ...screen.getAllByRole('button', { name: 'Akun Saya' }),
      ...screen.getAllByRole('button', { name: 'Akun' }),
    ]) {
      expect(button).toHaveClass('min-h-11')
    }
  })

  it('labels structured profile fields and email input', () => {
    renderWithProviders(
      <>
        <ChangeNameSection />
        <ChangeEmailSection />
      </>,
    )

    expect(screen.getByLabelText('Nama depan')).toHaveAttribute(
      'autocomplete',
      'given-name',
    )
    expect(screen.getByLabelText('Nama belakang')).toHaveAttribute(
      'autocomplete',
      'family-name',
    )
    expect(screen.getByLabelText('Email baru')).toHaveAttribute('type', 'email')
  })

  it('exposes member catalogue chips as disabled read-only controls', async () => {
    renderWithProviders(
      <CategorySection householdId="household-001" canManage={false} />,
      { household: { role: Role.MEMBER } },
    )
    const chip = await screen.findByRole('button', { name: 'Belanja' })
    expect(chip).toBeDisabled()
    expect(screen.getByText(/hanya admin/i)).toBeInTheDocument()
  })

  it('announces email-flow failures without dropping the entered address', async () => {
    server.use(
      http.post('*/api/v1/auth/change-email', () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Email already used' } },
          { status: 409 },
        ),
      ),
    )
    renderWithProviders(<ChangeEmailSection />)
    const section = screen.getByRole('heading', { name: 'Ubah email' })
      .closest('section')!
    const input = within(section).getByLabelText('Email baru')
    await userEvent.type(input, 'used@example.com')
    await userEvent.click(within(section).getByRole('button', { name: /kirim/i }))

    expect(await within(section).findByRole('alert')).toHaveTextContent(
      'Email already used',
    )
    expect(input).toHaveValue('used@example.com')
  })
})
