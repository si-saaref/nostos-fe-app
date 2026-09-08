import { http, HttpResponse } from 'msw'
import { screen } from '@testing-library/react'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/test/test-utils'
import { PreferencesSection } from '@/modules/settings/components/PreferencesSection'
import { MOCK_ME } from '@/mocks/fixtures/household'

const prefsFails = (status: number) =>
  server.use(
    http.get('*/api/v1/households/:id/prefs', () =>
      HttpResponse.json(
        {
          success: false,
          error: {
            code: status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: 'nope',
            status_code: status,
          },
        },
        { status },
      ),
    ),
  )

/** The route 404s on the live API. Copy is Indonesian: tests pin the base locale. */
describe('PreferencesSection when the prefs route is missing', () => {
  it('says the household settings are not on the server yet, not that they failed', async () => {
    prefsFails(404)
    renderWithProviders(
      <PreferencesSection householdId={MOCK_ME.household_id} canManage />,
    )
    expect(
      await screen.findByText(/belum tersedia di server/i),
    ).toBeInTheDocument()
    expect(screen.queryByText('Gagal memuat.')).not.toBeInTheDocument()
  })

  it('still reports a real failure as a failure', async () => {
    prefsFails(500)
    renderWithProviders(
      <PreferencesSection householdId={MOCK_ME.household_id} canManage />,
    )
    expect(await screen.findByText('Gagal memuat.')).toBeInTheDocument()
  })
})
