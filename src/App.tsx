import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { RouterProvider } from 'react-router-dom'
import { queryClient } from '@/api/queryClient'
import { HouseholdProvider } from '@/contexts/HouseholdContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { router } from '@/routes'

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <HouseholdProvider>
            <RouterProvider router={router} />
          </HouseholdProvider>
        </SettingsProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
