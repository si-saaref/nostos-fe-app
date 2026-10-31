import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { useLocation } from 'react-router-dom'
import { ChangeEmailSection } from '@/modules/settings/components/ChangeEmailSection'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/test/test-utils'

const LocationProbe = () => {
  const location = useLocation()
  return (
    <output data-testid="location">
      {location.pathname}
      {location.hash}
    </output>
  )
}

describe('ChangeEmailSection', () => {
  it('starts the inbox flow without navigating away from My Account', async () => {
    server.use(
      http.post('*/api/v1/auth/change-email', () =>
        HttpResponse.json({
          success: true,
          message: 'Check your new address for a confirmation link',
          data: { new_email: 'baru@example.com' },
        }),
      ),
    )
    renderWithProviders(
      <>
        <ChangeEmailSection />
        <LocationProbe />
      </>,
      { initialEntries: ['/settings#profil'] },
    )

    await userEvent.type(
      screen.getByLabelText(/email baru/i),
      'BARU@example.com',
    )
    await userEvent.click(screen.getByRole('button', { name: /kirim/i }))

    const notification = await screen.findByRole('status', {
      name: /konfirmasi terkirim/i,
    })
    expect(notification).toHaveTextContent(/cek email lama/i)
    expect(notification.closest('section')).toBeNull()
    expect(screen.getByTestId('location')).toHaveTextContent('/settings#profil')
  })
})
