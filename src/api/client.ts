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

/** The anonymous probe: a 401 here is the expected answer, not a lost session. */
const isSessionProbe = (url: string | undefined): boolean => {
  if (!url) return false
  try {
    return new URL(url, 'http://local').pathname.endsWith('/auth/session')
  } catch {
    return false
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/auth') &&
      !isSessionProbe(error.config?.url)
    ) {
      window.location.assign('/auth/login')
    }
    return Promise.reject(error)
  },
)
