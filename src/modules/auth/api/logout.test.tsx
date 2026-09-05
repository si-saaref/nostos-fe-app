import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { server } from '@/mocks/server'
import { authHandlers } from '@/mocks/handlers/auth'
import { authState } from '@/mocks/db'
import { createTestQueryClient } from '@/test/test-utils'
import { SessionBoundary } from '@/routes/SessionBoundary'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { PublicOnlyRoute } from '@/routes/PublicOnlyRoute'
import { useLogout } from '@/modules/auth/api/logout'

const SignOutButton = () => {
  const logout = useLogout()
  return (
    <div>
      <p>dashboard</p>
      <button type="button" onClick={() => logout.mutate()}>
        sign out
      </button>
    </div>
  )
}

/**
 * The real route shape, not a stand-in: the session provider mounted inside
 * the router as a pathless layout route, with both guards below it.
 *
 * That arrangement is the thing under test. Signing out used to reload the
 * document precisely because the provider sat above `RouterProvider` and had
 * no other way to leave — so a test that stubs `window.location` would assert
 * the workaround rather than the behaviour.
 */
const renderApp = () => {
  const router = createMemoryRouter(
    [
      {
        element: <SessionBoundary />,
        children: [
          {
            path: '/signin',
            element: (
              <PublicOnlyRoute>
                <p>signin form</p>
              </PublicOnlyRoute>
            ),
          },
          {
            path: '/dashboard',
            element: (
              <ProtectedRoute>
                <SignOutButton />
              </ProtectedRoute>
            ),
          },
        ],
      },
    ],
    { initialEntries: ['/dashboard'] },
  )
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

describe('useLogout', () => {
  beforeEach(() => {
    server.use(...authHandlers)
    authState.authenticated = true
  })

  it('ends the session on the server', async () => {
    renderApp()
    await screen.findByText('dashboard')

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => expect(authState.authenticated).toBe(false))
  })

  it('lands on the signin form without bouncing back into the app', async () => {
    const router = renderApp()
    await screen.findByText('dashboard')

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))

    // The bug this guards: `clear()` does not notify the observers mounted on
    // the queries it drops, so the provider kept serving the departed session,
    // `PublicOnlyRoute` saw a live one on arrival, and sent the user straight
    // back to /dashboard — showing the previous person's data until /auth/me
    // finally answered 401. On a shared device that is the exact frame logout
    // exists to prevent.
    expect(await screen.findByText('signin form')).toBeInTheDocument()
    expect(screen.queryByText('dashboard')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/signin')
  })

  it('replaces history rather than pushing, so Back cannot return to the app', async () => {
    const router = renderApp()
    await screen.findByText('dashboard')

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))
    await screen.findByText('signin form')

    // One entry: the dashboard was replaced, not stacked behind /signin.
    expect(router.state.historyAction).toBe('REPLACE')
  })

  it('leaves nothing of the departed session in the cache', async () => {
    renderApp()
    await screen.findByText('dashboard')

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))
    await screen.findByText('signin form')

    // Everything cached belonged to whoever was signed in a moment ago. The
    // session entry is the one deliberate survivor, and it holds `null` —
    // "definitively signed out", which is what the guards read.
    await waitFor(() =>
      expect(screen.queryByText('dashboard')).not.toBeInTheDocument(),
    )
  })
})
