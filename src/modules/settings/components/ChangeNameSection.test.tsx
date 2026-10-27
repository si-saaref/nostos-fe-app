import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { ChangeNameSection } from '@/modules/settings/components/ChangeNameSection'
import { server } from '@/mocks/server'
import { MOCK_ME } from '@/mocks/fixtures/household'
import { renderWithProviders } from '@/test/test-utils'

describe('ChangeNameSection', () => {
  it('prefills structured names and saves both fields', async () => {
    let body: unknown
    server.use(
      http.patch('*/api/v1/auth/me/name', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          success: true,
          data: { ...MOCK_ME, first_name: 'Budi', last_name: 'Wijaya' },
        })
      }),
    )
    renderWithProviders(<ChangeNameSection />)

    expect(screen.getByLabelText(/nama depan/i)).toHaveValue('Budi')
    expect(screen.getByLabelText(/nama belakang/i)).toHaveValue('Santoso')
    await userEvent.clear(screen.getByLabelText(/nama belakang/i))
    await userEvent.type(screen.getByLabelText(/nama belakang/i), 'Wijaya')
    await userEvent.click(screen.getByRole('button', { name: /^simpan$/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/tersimpan/i)
    expect(body).toEqual({ first_name: 'Budi', last_name: 'Wijaya' })
  })

  it('keeps both names editable and announces a save failure', async () => {
    server.use(
      http.patch('*/api/v1/auth/me/name', () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Name update failed' } },
          { status: 409 },
        ),
      ),
    )
    renderWithProviders(<ChangeNameSection />)

    await userEvent.clear(screen.getByLabelText(/nama depan/i))
    await userEvent.type(screen.getByLabelText(/nama depan/i), 'Ayu')
    await userEvent.click(screen.getByRole('button', { name: /^simpan$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Name update failed')
    expect(screen.getByLabelText(/nama depan/i)).toHaveValue('Ayu')
    expect(screen.getByLabelText(/nama belakang/i)).toHaveValue('Santoso')
  })
})
