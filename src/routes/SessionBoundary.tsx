import { Outlet } from 'react-router-dom'
import { HouseholdProvider } from '@/contexts/HouseholdContext'

/**
 * A pathless layout route whose only job is to put the session in scope.
 *
 * The session provider belongs *inside* the router, not above `RouterProvider`
 * in `App.tsx` where it used to sit. Above it, the provider had no router
 * context — so anything that needed to both read the session and navigate had
 * to reach for `window.location` and reload the whole document. `useLogout`
 * did exactly that, and it read as a hack because it was one.
 *
 * A pathless route is the seam React Router provides for this: it wraps every
 * child route without owning a URL segment, so `ProtectedRoute` and
 * `PublicOnlyRoute` read a session mounted in the same tree they navigate
 * within. It lives beside those two because it is the same kind of thing — a
 * route that decides what the routes below it can see.
 */
export const SessionBoundary = () => (
  <HouseholdProvider>
    <Outlet />
  </HouseholdProvider>
)
