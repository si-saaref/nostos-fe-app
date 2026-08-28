import { render, screen, waitFor, act } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HouseholdProvider } from '@/contexts/HouseholdContext'
import { useHousehold } from '@/contexts/useHousehold'
import { createTestQueryClient } from '@/test/test-utils'
import { apiClient } from '@/api/client'

function Probe() {
  const { isAuthenticated, householdId, isLoading } = useHousehold()
  if (isLoading) return <span>loading</span>
  return <span>{isAuthenticated ? `auth:${householdId}` : 'anon'}</span>
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
  it('exposes an anonymous session when not logged in', async () => {
    renderProvider()
    await waitFor(() => expect(screen.getByText('anon')).toBeInTheDocument())
  })

  it('exposes the household once a session exists', async () => {
    await act(async () => {
      await apiClient.post('/auth/login', {
        email: 'alex@example.com',
        password: 'x',
      })
    })
    renderProvider()
    await waitFor(() =>
      expect(screen.getByText('auth:household-001')).toBeInTheDocument(),
    )
  })
})
