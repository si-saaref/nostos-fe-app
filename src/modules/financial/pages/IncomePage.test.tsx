import { describe, expect, it, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { server } from '@/mocks/server'
import { errorBody } from '@/mocks/handlers/shared'
import { renderWithProviders } from '@/test/test-utils'
import { db, resetMockState } from '@/mocks/db'
import { MOCK_ME } from '@/mocks/fixtures/household'
import { IncomePage } from '@/modules/financial/pages/IncomePage'
import { Role } from '@/types/household'
import { isoDay, monthRange } from '@/utils/dates'

const thisMonth = monthRange(new Date())

beforeEach(() => {
  resetMockState()
})

const renderPage = (household?: Parameters<typeof renderWithProviders>[1]) =>
  renderWithProviders(<IncomePage />, household)

const settled = async () =>
  waitFor(() =>
    expect(screen.queryByText(/memuat pemasukan|loading income/i)).toBeNull(),
  )

describe('IncomePage', () => {
  it('states the position with its own date, apart from the month figures', async () => {
    renderPage()
    await settled()

    const position = await screen.findByRole('region', {
      name: /posisi|position/i,
    })
    // Cumulative to a day, and it says so — the strip beside it is a month.
    expect(
      within(position).getByText(/seluruh riwayat|all months/i),
    ).toBeInTheDocument()
  })

  it('subtotals the sources by kind, not one flat list of six', async () => {
    renderPage()
    await settled()

    const position = await screen.findByRole('region', {
      name: /posisi|position/i,
    })
    // The fixture holds three banks, two e-wallets and one cash source.
    expect(within(position).getByText(/Bank · 3/)).toBeInTheDocument()
    expect(within(position).getByText(/· 2/)).toBeInTheDocument()
  })

  it('groups the statement onto day shelves that name the date in full', async () => {
    renderPage()
    await settled()

    // Weekday, day and month on every shelf — not a bare "4 FRI", which on a
    // month-scoped page told the reader almost nothing.
    const shelves = await screen.findAllByRole('heading', { level: 3 })
    expect(shelves.length).toBeGreaterThan(1)
    shelves.forEach((shelf) => {
      expect(shelf.textContent).toMatch(/\d/)
      // A weekday and a month name either side of the number.
      expect(shelf.textContent!.split(/\s+/).length).toBeGreaterThanOrEqual(3)
    })
  })

  it('states a mixed day as arrival and movement, never one gross figure', async () => {
    // The fixture puts a salary and a withdrawal on the 1st of every month.
    renderPage()
    await settled()

    const day = await screen.findByRole('region', {
      name: /1 September|September 1/i,
    })
    // 8.600.000 arrived, 1.200.000 only changed pockets. Their sum, 9.800.000,
    // is money the household never gained and must appear nowhere.
    expect(day.textContent).toMatch(/8[.,]600[.,]000/)
    expect(day.textContent).toMatch(/1[.,]200[.,]000/)
    expect(day.textContent).not.toMatch(/9[.,]800[.,]000/)
    expect(day.textContent).toMatch(/pindah|moved/i)
  })

  it('names a transfer-only day as moved, so it cannot read as earnings', async () => {
    renderPage()
    await settled()

    // The 2nd carries one deposit and nothing from outside.
    const day = await screen.findByRole('region', {
      name: /2 September|September 2/i,
    })
    expect(day.textContent).toMatch(/pindah|moved/i)
    expect(day.textContent).not.toMatch(/\+/)
  })

  it('signs an external inflow and leaves a transfer unsigned', async () => {
    renderPage()
    await settled()

    // A salary raised what the household holds.
    const salaryRow = screen.getAllByText(/Gaji bulan ini/i)[0].closest('li')!
    expect(salaryRow.textContent).toMatch(/\+Rp/)

    // A withdrawal moved money it already had, so it must not read as a gain.
    const withdrawalRow = screen
      .getAllByText(/Tarik tunai awal bulan/i)[0]
      .closest('li')!
    expect(withdrawalRow.textContent).not.toMatch(/\+Rp/)
  })

  it('names both sources of a transfer, and marks external money as external', async () => {
    renderPage()
    await settled()

    const withdrawalRow = screen
      .getAllByText(/Tarik tunai awal bulan/i)[0]
      .closest('li')!
    expect(withdrawalRow.textContent).toMatch(/BNI/)
    expect(withdrawalRow.textContent).toMatch(/Tunai/)

    const salaryRow = screen.getAllByText(/Gaji bulan ini/i)[0].closest('li')!
    expect(salaryRow.textContent).toMatch(/dari luar|external/i)
  })

  it("spells out a transfer's two sides when the row is opened", async () => {
    renderPage()
    await settled()

    await userEvent.click(screen.getAllByText(/Tarik tunai awal bulan/i)[0])

    expect(
      await screen.findByText(
        /total rumah tidak berubah|household total unchanged/i,
      ),
    ).toBeInTheDocument()
  })

  it('hides edit and delete from a member', async () => {
    renderPage({ household: { role: Role.MEMBER } })
    await settled()

    await userEvent.click(screen.getAllByText(/Gaji bulan ini/i)[0])

    expect(screen.queryByRole('button', { name: /ubah|edit/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /hapus|delete/i })).toBeNull()
  })

  it('names the entry in the delete confirmation, and removes it on confirm', async () => {
    renderPage()
    await settled()

    await userEvent.click(screen.getAllByText(/Gaji bulan ini/i)[0])
    await userEvent.click(
      await screen.findByRole('button', { name: /^(hapus|delete)$/i }),
    )

    const dialog = await screen.findByRole('dialog')
    // Named, not "this entry": an admin about to delete a money record is
    // entitled to see which one.
    expect(dialog.textContent).toMatch(/Gaji bulan ini/)

    await userEvent.click(
      within(dialog).getByRole('button', { name: /ya, hapus|yes, delete/i }),
    )

    await waitFor(() =>
      expect(screen.queryByText(/Gaji bulan ini/i)).toBeNull(),
    )
  })

  it('says balances are unavailable rather than showing a zero, when the route is missing', async () => {
    server.use(
      http.get('*/api/v1/positions', () =>
        errorBody(404, 'NOT_FOUND', 'Not found'),
      ),
    )
    renderPage()
    await settled()

    expect(
      await screen.findByText(
        /saldo belum bisa ditampilkan|balances cannot be shown yet/i,
      ),
    ).toBeInTheDocument()
    // A household total of Rp 0 would be a claim nobody has checked.
    const position = screen.getByRole('region', { name: /posisi|position/i })
    expect(within(position).queryByText(/Rp\s?0/)).toBeNull()
  })

  it('words a short source and a short subtotal, never colour alone', async () => {
    // Drain one e-wallet past its balance. Legal per the PRD, so it must read
    // as a state and not as a bug — and a red minus sign at 11px is not a
    // distinction a colour-blind reader can make.
    db.expenses.unshift({
      id: 'exp-drain',
      name: 'Overspend',
      value: 90000000,
      typeId: db.categories[0].id,
      sourceId: 'source-qris',
      datePaid: thisMonth.from,
      paidByUserId: db.members[0].id,
      householdId: MOCK_ME.household_id,
      deletedAt: null,
    })
    renderPage()
    await settled()

    const position = await screen.findByRole('region', {
      name: /posisi|position/i,
    })
    // The source says it.
    expect(
      within(position).getAllByText(/minus|overspent/i).length,
    ).toBeGreaterThan(0)
    // And so does the kind subtotal it rolls up into.
    expect(within(position).getByText(/^(minus|short)$/i)).toBeInTheDocument()
  })

  it('reports an empty month as a fact about that month, with a way back', async () => {
    // Everything this household ever recorded, moved out of the month in view.
    db.income = db.income.filter((row) => row.date < thisMonth.from)
    renderPage()
    await settled()

    expect(
      await screen.findByText(/tidak ada catatan di|nothing recorded in/i),
    ).toBeInTheDocument()
    // Never "no income recorded" — the household has plenty, just not here.
    expect(screen.getByRole('button', { name: /←/ })).toBeInTheDocument()
  })

  it('keeps the position populated on a month with no entries', async () => {
    db.income = db.income.filter((row) => row.date < thisMonth.from)
    renderPage()
    await settled()

    const position = await screen.findByRole('region', {
      name: /posisi|position/i,
    })
    expect(within(position).getByText(/Bank · 3/)).toBeInTheDocument()
  })

  it('offers no way back when the household has recorded nothing at all', async () => {
    db.income = []
    renderPage()
    await settled()

    expect(screen.queryByRole('button', { name: /←/ })).toBeNull()
    expect(
      screen.getByText(/pemasukan pertama|first income/i),
    ).toBeInTheDocument()
  })

  it('surfaces a failed read with a retry rather than an empty month', async () => {
    server.use(
      http.get('*/api/v1/income', () => errorBody(500, 'SERVER_ERROR', 'boom')),
    )
    renderPage()

    expect(
      await screen.findByText(/gagal memuat pemasukan|could not load income/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/tidak ada catatan|nothing recorded/i)).toBeNull()
  })

  it('records an inflow from the inline form', async () => {
    renderPage()
    await settled()

    await userEvent.click(
      screen.getByRole('button', { name: /catat pemasukan|record income/i }),
    )

    const description = screen.getByLabelText(/keterangan|description/i)
    await userEvent.type(description, 'Gaji ke-13')
    await userEvent.type(screen.getByLabelText(/jumlah|amount/i), '3000000')

    const typeTrigger = screen.getByRole('combobox', { name: /jenis|type/i })
    await userEvent.click(typeTrigger)
    await userEvent.click(
      within(await screen.findByRole('listbox')).getAllByRole('option')[1],
    )

    const intoTrigger = screen.getByRole('combobox', {
      name: /masuk ke sumber|into source/i,
    })
    await userEvent.click(intoTrigger)
    await userEvent.click(
      within(await screen.findByRole('listbox')).getAllByRole('option')[1],
    )

    await userEvent.click(
      screen.getByRole('button', { name: /^(catat|record)$/i }),
    )

    await waitFor(() =>
      expect(screen.getAllByText(/Gaji ke-13/).length).toBeGreaterThan(0),
    )
  })

  it('refuses a transfer into the source it came from, before submitting', async () => {
    renderPage()
    await settled()

    await userEvent.click(
      screen.getByRole('button', { name: /catat pemasukan|record income/i }),
    )
    await userEvent.type(
      screen.getByLabelText(/keterangan|description/i),
      'Nowhere',
    )
    await userEvent.type(screen.getByLabelText(/jumlah|amount/i), '1000')

    const pickFirstSource = async (name: RegExp) => {
      await userEvent.click(screen.getByRole('combobox', { name }))
      const listbox = await screen.findByRole('listbox')
      await userEvent.click(within(listbox).getAllByRole('option')[1])
    }
    await pickFirstSource(/dari sumber|from source/i)
    await pickFirstSource(/masuk ke sumber|into source/i)

    await userEvent.click(
      screen.getByRole('button', { name: /^(catat|record)$/i }),
    )

    expect(
      await screen.findByText(/sumber yang sama|to the same source/i),
    ).toBeInTheDocument()
  })

  it('will not offer a future date', async () => {
    renderPage()
    await settled()

    await userEvent.click(
      screen.getByRole('button', { name: /catat pemasukan|record income/i }),
    )
    expect(screen.getByLabelText(/tanggal|date/i)).toHaveAttribute(
      'max',
      isoDay(new Date()),
    )
  })
})
