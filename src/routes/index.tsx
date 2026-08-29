import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthLayout } from '@/components/Layout/AuthLayout'
import { DashboardLayout } from '@/components/Layout/DashboardLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { LoginPage } from '@/modules/auth/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ErrorPage } from '@/pages/ErrorPage'
import { Loading } from '@/components/Loading'

// eslint-disable-next-line react-refresh/only-export-components -- lazy-loaded component is local to this router file, not exported
const ExpensesPage = lazy(() =>
  import('@/modules/financial/pages/ExpensesPage').then((module) => ({
    default: module.ExpensesPage,
  })),
)

// eslint-disable-next-line react-refresh/only-export-components -- lazy-loaded component is local to this router file, not exported
const SettingsPage = lazy(() =>
  import('@/modules/settings/pages/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
)

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    errorElement: <ErrorPage />,
    children: [{ path: '/auth/login', element: <LoginPage /> }],
  },
  {
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard', element: <DashboardPage /> },
      {
        path: '/financial/expenses',
        element: (
          <Suspense fallback={<Loading />}>
            <ExpensesPage />
          </Suspense>
        ),
      },
      {
        path: '/settings',
        element: (
          <Suspense fallback={<Loading />}>
            <SettingsPage />
          </Suspense>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
