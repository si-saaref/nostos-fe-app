import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HouseholdContext } from '@/contexts/HouseholdContext'
import type { HouseholdContextValue } from '@/contexts/HouseholdContext'
import { PublicOnlyRoute } from '@/routes/PublicOnlyRoute'
import { TEST_HOUSEHOLD_VALUE } from '@/test/test-utils'

const renderAt = (value: HouseholdContextValue) =>
  render(
    <HouseholdContext.Provider value={value}>
      <MemoryRouter initialEntries={['/signin']}>
        <Routes>
          <Route
            path="/signin"
            element={
              <PublicOnlyRoute>
                <div>signin form</div>
              </PublicOnlyRoute>
            }
          />
          <Route path="/dashboard" element={<div>dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </HouseholdContext.Provider>,
  )

describe('PublicOnlyRoute', () => {
  it('shows the form to an anonymous visitor', () => {
    renderAt({ ...TEST_HOUSEHOLD_VALUE, isAuthenticated: false, me: null })
    expect(screen.getByText('signin form')).toBeInTheDocument()
  })

  it('sends an already-signed-in visitor to the dashboard', () => {
    // The tab that requested the link is still sitting here after the session
    // was minted elsewhere. It must not keep offering a form that does nothing.
    renderAt(TEST_HOUSEHOLD_VALUE)
    expect(screen.getByText('dashboard')).toBeInTheDocument()
    expect(screen.queryByText('signin form')).not.toBeInTheDocument()
  })

  it('waits rather than flashing the form while the session is still loading', () => {
    renderAt({
      ...TEST_HOUSEHOLD_VALUE,
      isAuthenticated: false,
      me: null,
      isLoading: true,
    })
    expect(screen.queryByText('signin form')).not.toBeInTheDocument()
  })
})
