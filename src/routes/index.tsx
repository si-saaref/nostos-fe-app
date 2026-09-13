import { lazy, Suspense } from 'react'
import { m as messages } from '@/paraglide/messages.js'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/Layout/DashboardLayout'
import { SessionBoundary } from '@/routes/SessionBoundary'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { PublicOnlyRoute } from '@/routes/PublicOnlyRoute'
import { SigninPage } from '@/modules/auth/pages/SigninPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ErrorPage } from '@/pages/ErrorPage'
import { Loading } from '@/components/Loading'
import { LegacyRedirect } from '@/routes/LegacyRedirect'

// eslint-disable-next-line react-refresh/only-export-components -- lazy-loaded component is local to this router file, not exported
const ExpensesPage = lazy(() =>
  import('@/modules/financial/pages/ExpensesPage').then((module) => ({
    default: module.ExpensesPage,
  })),
)

// eslint-disable-next-line react-refresh/only-export-components -- lazy-loaded component is local to this router file, not exported
const IncomePage = lazy(() =>
  import('@/modules/financial/pages/IncomePage').then((module) => ({
    default: module.IncomePage,
  })),
)

// eslint-disable-next-line react-refresh/only-export-components -- lazy-loaded component is local to this router file, not exported
const CalendarPage = lazy(() =>
  import('@/modules/financial/pages/CalendarPage').then((module) => ({
    default: module.CalendarPage,
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
    element: <SessionBoundary />,
    // One boundary for the whole tree. Every route below renders inside the
    // session, so an error in any of them can be shown by the same page.
    errorElement: <ErrorPage />,
    children: [
      // The only public route. The backend hardcodes `/signin` onto APP_URL
      // when it redirects a spent magic link, so this path is not ours to
      // rename.
      {
        path: '/signin',
        element: (
          <PublicOnlyRoute>
            <SigninPage />
          </PublicOnlyRoute>
        ),
      },
      {
        element: (
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          {
            path: '/expenses',
            element: (
              <Suspense
                fallback={<Loading full label={messages.tape_loading()} />}
              >
                <ExpensesPage />
              </Suspense>
            ),
          },
          {
            path: '/income',
            element: (
              <Suspense
                fallback={<Loading full label={messages.inc_loading()} />}
              >
                <IncomePage />
              </Suspense>
            ),
          },
          {
            path: '/calendar',
            element: (
              <Suspense
                fallback={<Loading full label={messages.state_loading()} />}
              >
                <CalendarPage />
              </Suspense>
            ),
          },
          {
            path: '/settings',
            element: (
              <Suspense
                fallback={<Loading full label={messages.state_loading()} />}
              >
                <SettingsPage />
              </Suspense>
            ),
          },

          // The ledgers moved out of `/financial/` on 2026-09-11. Filters live
          // in the query string, so a shared or bookmarked view is a real URL
          // someone holds — these carry it across rather than 404ing it.
          {
            path: '/financial/expenses',
            element: <LegacyRedirect to="/expenses" />,
          },
          {
            path: '/financial/income',
            element: <LegacyRedirect to="/income" />,
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
