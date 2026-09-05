import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { RouterProvider } from 'react-router-dom'
import { queryClient } from '@/api/queryClient'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { router } from '@/routes'

/**
 * Only the providers that have nothing to do with routing live here.
 *
 * The session provider deliberately does not: it sits inside the router as a
 * pathless layout route (`SessionBoundary` in `routes/index.tsx`), so that the
 * code which reads the session can also navigate. Anything mounted above
 * `RouterProvider` cannot, and the workarounds for that are worse than the
 * nesting.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <RouterProvider router={router} />
        </SettingsProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
