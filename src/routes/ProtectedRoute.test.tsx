import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { HouseholdContext } from '@/contexts/HouseholdContext'
import type { HouseholdContextValue } from '@/contexts/HouseholdContext'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { TEST_HOUSEHOLD_VALUE } from '@/test/test-utils'

const renderAt = (value: HouseholdContextValue) =>
  render(
    <HouseholdContext.Provider value={value}>
      <MemoryRouter initialEntries={['/secret']}>
        <Routes>
          <Route
            path="/secret"
            element={
              <ProtectedRoute>
                <div>secret content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/auth/login" element={<div>login screen</div>} />
        </Routes>
      </MemoryRouter>
    </HouseholdContext.Provider>,
  )

describe('ProtectedRoute', () => {
  it('renders children when authenticated', () => {
    renderAt(TEST_HOUSEHOLD_VALUE)
    expect(screen.getByText('secret content')).toBeInTheDocument()
  })

  it('redirects to login when unauthenticated', () => {
    renderAt({ ...TEST_HOUSEHOLD_VALUE, isAuthenticated: false, user: null })
    expect(screen.getByText('login screen')).toBeInTheDocument()
  })
})
