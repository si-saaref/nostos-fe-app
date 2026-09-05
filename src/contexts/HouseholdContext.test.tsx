import { render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HouseholdProvider } from '@/contexts/HouseholdContext'
import { useHousehold } from '@/contexts/useHousehold'
import { createTestQueryClient } from '@/test/test-utils'
import { server } from '@/mocks/server'
import { authHandlers } from '@/mocks/handlers/auth'
import { authState } from '@/mocks/db'

function Probe() {
  const { isAuthenticated, householdId, isLoading, me } = useHousehold()
  if (isLoading) return <span>loading</span>
  if (!isAuthenticated) return <span>anon</span>
  return <span>{`auth:${householdId}:${me?.household_name}`}</span>
}

const renderProvider = () =>
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <HouseholdProvider>
        <Probe />
      </HouseholdProvider>
    </QueryClientProvider>,
  )

describe('HouseholdProvider', () => {
  // Auth is not registered by default — it runs against the real backend.
  beforeEach(() => server.use(...authHandlers))

  it('exposes an anonymous session when nobody is signed in', async () => {
    renderProvider()
    await waitFor(() => expect(screen.getByText('anon')).toBeInTheDocument())
  })

  it('exposes the household name and id from /auth/me', async () => {
    authState.authenticated = true
    renderProvider()
    await waitFor(() =>
      expect(
        screen.getByText('auth:household-001:Keluarga Adios'),
      ).toBeInTheDocument(),
    )
  })
})
