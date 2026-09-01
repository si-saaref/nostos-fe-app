import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/Layout/DashboardLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { SigninPage } from '@/modules/auth/pages/SigninPage'
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
  // The only public route. The backend hardcodes `/signin` onto APP_URL when
  // it redirects a spent magic link, so this path is not ours to rename.
  {
    path: '/signin',
    element: <SigninPage />,
    errorElement: <ErrorPage />,
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
