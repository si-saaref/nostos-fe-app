import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { db } from '@/mocks/db'
import { renderWithProviders } from '@/test/test-utils'
import { CalculationStart } from './CalculationStart'

it('uses server lock even when an account has a zero balance and no loaded history', () => {
  renderWithProviders(
    <CalculationStart
      householdId="household-001"
      account={{
        ...db.accounts[0],
        openingBalance: 0,
        calculationStartCanSet: false,
      }}
    />,
  )
  expect(screen.queryByRole('button', { name: /tetapkan tanggal/i })).toBeNull()
  expect(screen.getByText(/terkunci/i)).toBeInTheDocument()
})

it('preserves the chosen date and server lock error when a concurrent correction wins', async () => {
  server.use(
    http.patch('*/payment-sources/:id', () =>
      HttpResponse.json(
        {
          success: false,
          error: {
            code: 'CALCULATION_START_LOCKED',
            message: 'Calculation start locked by correction',
          },
        },
        { status: 409 },
      ),
    ),
  )
  renderWithProviders(
    <CalculationStart
      householdId="household-001"
      account={{ ...db.accounts[0], calculationStartCanSet: true }}
    />,
  )
  const date = screen.getByLabelText(/^tanggal mulai hitung$/i)
  await userEvent.click(date)
  await userEvent.click(screen.getByRole('button', { name: /^kemarin$/i }))
  const chosen = date.textContent
  const assign = screen.getByRole('button', { name: /tetapkan tanggal/i })
  await waitFor(() => expect(assign).toBeEnabled())
  await userEvent.click(assign)
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: /tetapkan tanggal/i,
    }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Calculation start locked by correction',
  )
  expect(date).toHaveTextContent(chosen!)
})

it('opens baseline help by keyboard and restores focus on close', async () => {
  renderWithProviders(
    <CalculationStart
      householdId="household-001"
      account={{ ...db.accounts[0], calculationStartCanSet: false }}
    />,
  )
  const help = screen.getByRole('button', { name: /tentang tanggal/i })
  help.focus()
  await userEvent.keyboard('{Enter}')
  expect(screen.getByRole('dialog')).toHaveTextContent(
    /catatan sebelumnya tetap terlihat/i,
  )
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(help).toHaveFocus()
})
