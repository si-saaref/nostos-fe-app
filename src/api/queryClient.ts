import { QueryClient } from '@tanstack/react-query'
import axios from 'axios'

/**
 * Retrying a 4xx cannot help: the request was wrong, not unlucky. It also makes
 * a 401 worse — the response interceptor starts the redirect on the first
 * rejection, and further attempts are fired into a page that is unloading.
 */
const retryServerErrorsOnly = (failureCount: number, error: unknown) => {
  if (failureCount >= 2) return false
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    // No response at all is a network blip, which is worth retrying.
    return status === undefined || status >= 500
  }
  return true
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: retryServerErrorsOnly,
    },
    mutations: {
      retry: false,
    },
  },
})
