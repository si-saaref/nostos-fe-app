import { describe, expect, it, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { db, resetMockState } from '@/mocks/db'
import { MOCK_ME } from '@/mocks/fixtures/household'
import { IncomeTypeSection } from '@/modules/settings/components/IncomeTypeSection'

const HOUSEHOLD = MOCK_ME.household_id

const render = (canManage = true) =>
  renderWithProviders(
    <IncomeTypeSection householdId={HOUSEHOLD} canManage={canManage} />,
  )

beforeEach(() => {
  resetMockState()
})

describe('IncomeTypeSection', () => {
  it('lists the household types it already has, and offers no presets', async () => {
    render()

    expect(await screen.findByText('gaji')).toBeInTheDocument()
    expect(
      screen.queryByText(/mulai dari yang biasa|start from the usual/i),
    ).toBeNull()
  })

  it('offers presets while the household has none', async () => {
    db.incomeTypes = []
    render()

    expect(
      await screen.findByText(/mulai dari yang biasa|start from the usual/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /\+\s*(gaji|salary)/i }),
    ).toBeInTheDocument()
  })

  it('a preset creates a real row the household then owns', async () => {
    db.incomeTypes = []
    render()

    await userEvent.click(
      await screen.findByRole('button', { name: /\+\s*(bonus)/i }),
    )

    await waitFor(() =>
      expect(db.incomeTypes.map((type) => type.name)).toContain('Bonus'),
    )
  })

  it('stops offering presets once the first type exists, with no timer involved', async () => {
    db.incomeTypes = []
    render()

    await userEvent.click(
      await screen.findByRole('button', { name: /\+\s*(gaji|salary)/i }),
    )

    // The offer is keyed on "has this household got any types", which is a
    // real question with a server-side answer — not on a five-minute
    // localStorage timer that a second admin's phone would never have seen.
    await waitFor(() =>
      expect(
        screen.queryByText(/mulai dari yang biasa|start from the usual/i),
      ).toBeNull(),
    )
  })

  it('rejects a duplicate name rather than splitting the household history', async () => {
    render()

    await userEvent.click(
      await screen.findByRole('button', { name: /tambah kategori pemasukan|add income category/i }),
    )
    await userEvent.type(
      screen.getByLabelText(/nama kategori pemasukan|income category name/i),
      'Gaji',
    )
    await userEvent.click(
      screen.getByRole('button', { name: /^(tambah|add)$/i }),
    )

    // Case-insensitive: "Gaji" and "gaji" are one word to the family that
    // typed them.
    expect(await screen.findByRole('alert')).toHaveTextContent(/sudah ada/i)
  })

  it('shows a member the list without any way to change it', async () => {
    render(false)

    expect(await screen.findByText('gaji')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /tambah kategori pemasukan|add income category/i }),
    ).toBeNull()
    expect(screen.getByText(/hanya admin|only admins/i)).toBeInTheDocument()
  })

  it('does not show a count derived from only the first ledger page', async () => {
    render()

    await screen.findByText('tarik tunai')
    expect(
      screen.queryByText(/dipakai \d+ pemasukan|used by \d+ income/i),
    ).toBeNull()
  })
})
