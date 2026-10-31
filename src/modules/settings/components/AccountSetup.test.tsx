import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { db } from '@/mocks/db'
import { renderWithProviders } from '@/test/test-utils'
import { CalculationStart } from './CalculationStart'

it('requires an explicit opening amount and sends zero with the start date atomically', async () => {
  let body: unknown
  server.use(
    http.patch('*/api/v1/payment-sources/:id', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(
        { success: false, error: { message: 'Setup conflict' } },
        { status: 409 },
      )
    }),
  )
  renderWithProviders(
    <CalculationStart
      householdId="household-001"
      account={{ ...db.accounts[0], calculationStartCanSet: true }}
    />,
  )
  const submit = screen.getByRole('button', { name: /tetapkan saldo awal/i })
  expect(submit).toBeDisabled()
  await userEvent.type(screen.getByLabelText(/^saldo awal$/i), '0')
  await waitFor(() => expect(submit).toBeEnabled())
  await userEvent.click(submit)
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: /tetapkan saldo awal/i,
    }),
  )
  await waitFor(() =>
    expect(body).toEqual({
      as_of: db.accounts[0].asOf,
      opening_balance: '0.00',
    }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent('Setup conflict')
  expect(screen.getByLabelText(/^saldo awal$/i)).toHaveValue('0')
})
