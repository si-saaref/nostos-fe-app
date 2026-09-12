import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { LegacyRedirect } from '@/routes/LegacyRedirect'

const Landed = () => {
  const { pathname, search, hash } = useLocation()
  return <p>{`${pathname}${search}${hash}`}</p>
}

const arriveAt = (from: string) =>
  render(
    <MemoryRouter initialEntries={[from]}>
      <Routes>
        <Route
          path="/financial/expenses"
          element={<LegacyRedirect to="/expenses" />}
        />
        <Route path="/expenses" element={<Landed />} />
      </Routes>
    </MemoryRouter>,
  )

/**
 * The ledgers moved out of `/financial/` on 2026-09-11. Filters live in the
 * query string, so an old link is a real view someone saved — dropping the
 * search would land them on today's unfiltered month and read as the filters
 * having been forgotten.
 */
describe('LegacyRedirect', () => {
  it('moves a bare path to the new one', () => {
    arriveAt('/financial/expenses')
    expect(screen.getByText('/expenses')).toBeInTheDocument()
  })

  it('carries the filters across', () => {
    arriveAt('/financial/expenses?dateFrom=2026-03-01&type=t1&q=beras')
    expect(
      screen.getByText('/expenses?dateFrom=2026-03-01&type=t1&q=beras'),
    ).toBeInTheDocument()
  })

  it('carries a hash across, which is how Settings is deep-linked', () => {
    arriveAt('/financial/expenses#anchor')
    expect(screen.getByText('/expenses#anchor')).toBeInTheDocument()
  })
})
