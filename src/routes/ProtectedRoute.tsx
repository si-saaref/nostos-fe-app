import type { ReactNode } from 'react'
import { m as messages } from '@/paraglide/messages.js'
import { Navigate } from 'react-router-dom'
import { useHousehold } from '@/contexts/useHousehold'
import { Loading } from '@/components/Loading'

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useHousehold()
  if (isLoading) return <Loading full label={messages.state_loading()} />
  if (!isAuthenticated) return <Navigate to="/signin" replace />
  return <>{children}</>
}
