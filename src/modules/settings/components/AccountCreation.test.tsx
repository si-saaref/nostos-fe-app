import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/test/test-utils'
import { AccountSection } from './AccountSection'

it('creates a named e-wallet without silently confirming a zero starting balance', async () => {
  let body: unknown
  server.use(
    http.post('*/api/v1/payment-sources', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(
        { error: { message: 'Review only' } },
        { status: 409 },
      )
    }),
  )
  renderWithProviders(<AccountSection householdId="household-001" canManage />)
  await userEvent.click(
    await screen.findByRole('button', { name: /^\+? tambah akun$/i }),
  )
  await userEvent.click(screen.getByRole('radio', { name: /e-wallet/i }))
  await userEvent.type(screen.getByLabelText(/^nama akun$/i), 'GoPay')
  expect(screen.queryByLabelText(/^saldo awal$/i)).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /^tambah$/i }))
  await waitFor(() => expect(body).toEqual({ name: 'GoPay', kind: 'EWALLET' }))
})
