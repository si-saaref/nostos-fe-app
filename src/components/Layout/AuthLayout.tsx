import { Navigate, Outlet } from 'react-router-dom'
import { useHousehold } from '@/contexts/useHousehold'
import { Loading } from '@/components/Loading'

export const AuthLayout = () => {
  const { isAuthenticated, isLoading } = useHousehold()
  if (isLoading) return <Loading />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <Outlet />
      </div>
    </div>
  )
}
