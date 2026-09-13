import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'
import { resetMockState } from '@/mocks/db'
import { CalendarPage } from '@/modules/financial/pages/CalendarPage'
import { monthRange } from '@/utils/dates'

const thisMonth = () => monthRange(new Date())

beforeEach(() => {
  resetMockState()
})

const settled = async () =>
  waitFor(() => expect(screen.getByRole('grid')).toBeInTheDocument())

describe('CalendarPage', () => {
  it('draws the month and its four figures', async () => {
    renderWithProviders(<CalendarPage />, { initialEntries: ['/calendar'] })
    await settled()

    expect(screen.getByRole('grid')).toBeInTheDocument()
    // Scoped: the grid legend names two of these streams as well, which is the
    // point — the strip states the month, the legend explains the marks.
    const strip = screen.getByRole('region', { name: 'Bulan ini' })
    expect(within(strip).getByText('Keluar')).toBeInTheDocument()
    expect(within(strip).getByText('Masuk')).toBeInTheDocument()
    expect(within(strip).getByText('Pindah')).toBeInTheDocument()
    expect(within(strip).getByText('Entri')).toBeInTheDocument()
  })

  it('opens the day that is clicked, and puts it in the URL', async () => {
    renderWithProviders(<CalendarPage />, {
      initialEntries: ['/calendar?month=2026-03'],
    })
    await settled()

    await userEvent.click(screen.getByRole('gridcell', { name: /^9 Mar/ }))

    await waitFor(() =>
      expect(
        screen.getByRole('complementary', { name: /9 Maret/ }),
      ).toBeInTheDocument(),
    )
  })

  it('opens nothing until asked, in a month that is not this one', async () => {
    renderWithProviders(<CalendarPage />, {
      initialEntries: ['/calendar?month=2026-03'],
    })
    await settled()

    expect(screen.getByText(/pilih satu hari/i)).toBeInTheDocument()
  })

  it('says a month with nothing in it recorded nothing', async () => {
    // Far enough back that the seeded ledger has not reached it.
    renderWithProviders(<CalendarPage />, {
      initialEntries: ['/calendar?month=2019-02'],
    })
    await settled()

    await waitFor(() =>
      expect(screen.getByText(/tidak ada catatan di/i)).toBeInTheDocument(),
    )
  })

  it('refuses to draw a month it does not hold every row of', async () => {
    const { from, to } = thisMonth()
    server.use(
      http.get('*/expenses', () =>
        HttpResponse.json({
          success: true,
          data: [],
          meta: {
            pagination: { page: 1, limit: 500, total: 612, total_pages: 2 },
            totals: { sum: 0, count: 612, average: 0 },
          },
        }),
      ),
    )
    void from
    void to

    renderWithProviders(<CalendarPage />, { initialEntries: ['/calendar'] })

    // A month drawn from one page of a two-page set would be missing days.
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /lebih banyak entri/i,
      ),
    )
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('names the problem and offers a retry when a ledger fails', async () => {
    server.use(
      http.get('*/income', () => new HttpResponse(null, { status: 500 })),
    )

    renderWithProviders(<CalendarPage />, { initialEntries: ['/calendar'] })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/gagal dimuat/i)
    expect(
      within(alert).getByRole('button', { name: /coba lagi/i }),
    ).toBeInTheDocument()
  })

  it('offers nothing that would change an entry', async () => {
    renderWithProviders(<CalendarPage />, { initialEntries: ['/calendar'] })
    await settled()

    const labels = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent)
      .join(' ')
    expect(labels).not.toMatch(/catat|ubah|hapus/i)
  })
})
