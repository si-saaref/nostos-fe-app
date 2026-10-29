import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { chooseOption, renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'
import { db } from '@/mocks/db'
import { IncomeForm } from './IncomeForm'

it('reveals an editable 2500 fee only after enabling it for a transfer', async () => {
  let body: Record<string, unknown>[] | undefined
  server.use(
    http.post('*/api/v1/income', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>[]
      return HttpResponse.json(
        { error: { message: 'Review only' } },
        { status: 409 },
      )
    }),
  )
  renderWithProviders(<IncomeForm />)
  expect(screen.queryByRole('switch', { name: /ada biaya admin/i })).toBeNull()
  await chooseOption(/uang ini dari mana/i, /pindah antar akun/i)
  expect(screen.queryByLabelText(/^biaya admin$/i)).toBeNull()
  await userEvent.type(screen.getByLabelText(/keterangan/i), 'Top up')
  await userEvent.type(screen.getByLabelText(/^jumlah$/i), '100000')
  await chooseOption(/dari sumber/i, /kartu debit bca/i)
  await chooseOption(/masuk ke sumber/i, /tunai/i)
  await userEvent.click(
    screen.getByRole('switch', { name: /ada biaya admin/i }),
  )
  const fee = screen.getByLabelText(/^biaya admin$/i)
  expect(fee).toHaveValue('2.500')
  expect(screen.getByText(/102.500/)).toBeInTheDocument()
  await userEvent.clear(fee)
  await userEvent.type(fee, '6500')
  expect(screen.getByText(/106.500/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /catat/i }))
  await waitFor(() => expect(body?.[0].fee_amount).toBe('6500.00'))
})

it('seeds an existing fee on edit and submits zero when the toggle is off', async () => {
  let body: Record<string, unknown> | undefined
  server.use(
    http.patch('*/api/v1/income/:id', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json(
        { error: { message: 'Review only' } },
        { status: 409 },
      )
    }),
  )
  const transfer = db.income.find((row) => row.kind === 'TRANSFER')!
  renderWithProviders(<IncomeForm income={{ ...transfer, feeAmount: 6500 }} />)
  expect(screen.getByRole('switch', { name: /ada biaya admin/i })).toBeChecked()
  expect(screen.getByLabelText(/^biaya admin$/i)).toHaveValue('6.500')
  await userEvent.click(
    screen.getByRole('switch', { name: /ada biaya admin/i }),
  )
  expect(screen.queryByLabelText(/^biaya admin$/i)).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /simpan/i }))
  await waitFor(() => expect(body?.fee_amount).toBe('0.00'))
})

it('requires a positive fee while the toggle is on', async () => {
  const transfer = db.income.find((row) => row.kind === 'TRANSFER')!
  renderWithProviders(<IncomeForm income={{ ...transfer, feeAmount: 2500 }} />)
  await userEvent.clear(screen.getByLabelText(/^biaya admin$/i))
  await userEvent.type(screen.getByLabelText(/^biaya admin$/i), '0')
  await userEvent.click(screen.getByRole('button', { name: /simpan/i }))
  expect(
    await screen.findByText(/isi biaya lebih dari nol/i),
  ).toBeInTheDocument()
})
