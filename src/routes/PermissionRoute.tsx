import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useHousehold } from '@/contexts/useHousehold'
import type { Role } from '@/types/household'

interface Props {
  requiredRole: Role
  children: ReactNode
}

export const PermissionRoute = ({ requiredRole, children }: Props) => {
  const { role } = useHousehold()
  if (role !== requiredRole) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}
