import axios from 'axios'
import type { AxiosResponse } from 'axios'
import { queryClient } from '@/api/queryClient'
import type { ApiEnvelope } from '@/types/api'

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
  baseURL: `${import.meta.env.VITE_API_URL ?? ''}/api/v1`,
  withCredentials: true,
})

apiClient.interceptors.request.use((config) => {
  if (currentHouseholdId) {
    config.headers.set('X-Household-ID', currentHouseholdId)
  }
  return config
})

/**
 * v1 wraps every response; the resource is always at `data.data`.
 *
 * The guard is not paranoia. An unwrapped or empty body silently yields
 * `undefined`, and TanStack rejects undefined query data with a message naming
 * neither the endpoint nor the shape — so a contract change would surface as a
 * mystery rather than as itself.
 */
export const unwrap = <T>(res: AxiosResponse<ApiEnvelope<T>>): T => {
  const body = res.data
  if (body == null || typeof body !== 'object' || !('data' in body)) {
    throw new Error(
      `Unenveloped response from ${res.config?.url ?? 'the API'}: expected { success, data }`,
    )
  }
  return body.data
}

/**
 * Endpoints whose 401 is an answer, not a lost session.
 *
 * `/auth/signin` answers 401 for "this address was never invited" — an inline
 * field error. `/auth/me` answers 401 for every anonymous visitor, which is how
 * the app learns nobody is signed in. Redirecting on either turns a normal
 * response into a navigation.
 *
 * Matched on the parsed pathname rather than a substring: a query string like
 * `?next=/auth/me` must not buy an exemption.
 */
const AUTH_ENDPOINTS = ['/auth/signin', '/auth/me', '/auth/logout']

const isAuthEndpoint = (url: string | undefined): boolean => {
  if (!url) return false
  try {
    const { pathname } = new URL(url, 'http://local')
    return AUTH_ENDPOINTS.some((path) => pathname.endsWith(path))
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
      !isAuthEndpoint(error.config?.url)
    ) {
      // Clear rather than invalidate: everything cached belongs to whoever was
      // signed in a moment ago, and on a shared device the next person must not
      // see a frame of it. A full assign, not router navigation — this runs
      // outside React and has no `useNavigate`.
      queryClient.clear()
      window.location.assign('/signin?error=session_ended')
    }
    return Promise.reject(error)
  },
)
