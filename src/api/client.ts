import axios from 'axios'

let currentHouseholdId = ''

/**
 * Feeds the household id to the axios request interceptor. Called from
 * HouseholdContext — interceptors cannot call React hooks, so the id is held in
 * module scope instead.
 */
export const setHouseholdId = (id: string): void => {
  currentHouseholdId = id
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
})

apiClient.interceptors.request.use((config) => {
  if (currentHouseholdId) {
    config.headers.set('X-Household-ID', currentHouseholdId)
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const status =
      typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined
    const requestUrl =
      typeof error === 'object' && error !== null && 'config' in error
        ? (error as { config?: { url?: string } }).config?.url
        : undefined
    if (
      status === 401 &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/auth') &&
      !requestUrl?.includes('/auth/session')
    ) {
      window.location.assign('/auth/login')
    }
    return Promise.reject(error)
  },
)
