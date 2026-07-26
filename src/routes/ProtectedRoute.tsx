import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useHousehold } from '@/contexts/useHousehold'
import { Loading } from '@/components/Loading'

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useHousehold()
  if (isLoading) return <Loading />
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />
  return <>{children}</>
}
