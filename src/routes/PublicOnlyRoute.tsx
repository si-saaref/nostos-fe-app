import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useHousehold } from '@/contexts/useHousehold'
import { Loading } from '@/components/Loading'

/**
 * The mirror of ProtectedRoute: somebody who already has a session has no
 * business on the signin screen.
 *
 * This matters most in the tab the link was requested from. The visitor types
 * their address here, opens the email somewhere else, and the redemption mints
 * the session in *that* tab — leaving this one showing a form that would do
 * nothing. Reading the session on mount is what turns the stale tab into the
 * dashboard.
 */
export const PublicOnlyRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useHousehold()

  if (isLoading) return <Loading />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
