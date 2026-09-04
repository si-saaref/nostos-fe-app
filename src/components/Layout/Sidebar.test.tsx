import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'
import { authHandlers } from '@/mocks/handlers/auth'
import { authState } from '@/mocks/db'
import { Sidebar } from '@/components/Layout/Sidebar'

/**
 * jsdom's window.location.assign is non-configurable, so vi.spyOn cannot wrap
 * it — swap in a stub Location instead.
 */
const stubLocation = () => {
  const assign = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname: '/dashboard', assign },
  })
  return assign
}

describe('Sidebar', () => {
  const originalLocation = window.location

  beforeEach(() => {
    server.use(...authHandlers)
    authState.authenticated = true
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('shows who is signed in and which household', () => {
    renderWithProviders(<Sidebar />)
    expect(screen.getByText('Budi')).toBeInTheDocument()
    expect(screen.getByText('Keluarga Adios')).toBeInTheDocument()
  })

  it('signs out through the API', async () => {
    stubLocation()
    renderWithProviders(<Sidebar />)

    await userEvent.click(screen.getByRole('button', { name: /keluar/i }))

    await waitFor(() => expect(authState.authenticated).toBe(false))
  })

  it('leaves the app entirely rather than routing to signin', async () => {
    // A router navigation is not enough. `queryClient.clear()` does not notify
    // the observers watching the cleared queries, so HouseholdProvider — which
    // sits above RouterProvider — keeps serving the departed session, and
    // PublicOnlyRoute bounces straight back to the dashboard. Only a full load
    // guarantees the session is really gone.
    const assign = stubLocation()
    renderWithProviders(<Sidebar />)

    await userEvent.click(screen.getByRole('button', { name: /keluar/i }))

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/signin'))
  })
})
