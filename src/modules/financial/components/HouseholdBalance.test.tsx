import { screen } from '@testing-library/react'
import { http, HttpResponse, delay } from 'msw'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'
import { HouseholdBalance } from './HouseholdBalance'

it('shares a current balance request and never displays a loading zero', async () => {
  let requests = 0
  server.use(
    http.get('*/api/v1/positions', async () => {
      requests++
      await delay(50)
      return HttpResponse.json({
        success: true,
        data: [],
        meta: {
          summary: {
            total_balance: '123.45',
            currency: 'USD',
            as_of: '2026-10-28',
          },
        },
      })
    }),
  )
  renderWithProviders(
    <>
      <HouseholdBalance />
      <HouseholdBalance />
    </>,
  )
  expect(screen.getAllByText('—')).toHaveLength(2)
  expect(await screen.findAllByText(/123.45/)).toHaveLength(2)
  expect(requests).toBe(1)
})
it('states when the balance is unavailable', async () => {
  server.use(
    http.get('*/api/v1/positions', () =>
      HttpResponse.json({}, { status: 503 }),
    ),
  )
  renderWithProviders(<HouseholdBalance />)
  expect(await screen.findByText(/tidak tersedia/i)).toBeInTheDocument()
})
