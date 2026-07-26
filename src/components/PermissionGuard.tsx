import type { ReactNode } from 'react'
import { useHousehold } from '@/contexts/useHousehold'
import type { Role } from '@/types/household'

interface Props {
  requiredRole: Role
  children: ReactNode
  fallback?: ReactNode
}

export const PermissionGuard = ({
  requiredRole,
  children,
  fallback = null,
}: Props) => {
  const { role } = useHousehold()
  if (role !== requiredRole) {
    return <>{fallback}</>
  }
  return <>{children}</>
}
