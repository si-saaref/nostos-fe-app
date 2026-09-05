import type { Mock } from 'vitest'
import { AxiosError } from 'axios'
import { apiClient, setHouseholdId } from '@/api/client'

/**
 * A real AxiosError, not a plain object shaped like one. The interceptor
 * guards on `axios.isAxiosError`, so a synthetic literal short-circuits the
 * whole rule and every assertion below would pass vacuously.
 */
const axiosError = (status: number, url: string): AxiosError => {
  const error = new AxiosError('Request failed', 'ERR_BAD_RESPONSE', {
    url,
  } as AxiosError['config'])
  error.response = { status } as AxiosError['response']
  return error
}

const runRejection = async (error: unknown) => {
  const handlers = apiClient.interceptors.response as unknown as {
    handlers: { rejected: (e: unknown) => Promise<never> }[]
  }
  return handlers.handlers[0].rejected(error)
}

/**
 * jsdom's window.location.assign is non-configurable, so vi.spyOn cannot wrap
 * it — swap in a stub Location instead. The pathname is deliberately a
 * protected route: the redirect rule must key on the request, not on where the
 * user happens to be standing.
 */
const withStubbedLocation = async (fn: (assign: Mock) => Promise<void>) => {
  const originalLocation = window.location
  const assign = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname: '/dashboard', assign },
  })
  try {
    await fn(assign)
  } finally {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  }
}

describe('apiClient', () => {
  it('is configured to send credentials', () => {
    expect(apiClient.defaults.withCredentials).toBe(true)
  })

  it('attaches X-Household-ID via the request interceptor after setHouseholdId', () => {
    setHouseholdId('household-999')
    // Run the request interceptor manually against a minimal config.
    const handlers = apiClient.interceptors.request as unknown as {
      handlers: {
        fulfilled: (c: { headers: Headers }) => { headers: Headers }
      }[]
    }
    const fulfilled = handlers.handlers[0].fulfilled
    const config = { headers: new Headers() }
    const result = fulfilled(config)
    expect(result.headers.get('X-Household-ID')).toBe('household-999')
  })

  it('does not redirect on a 401 from the signin request', async () => {
    // The API answers 401 for "no active user has this address". That is an
    // inline field error, not a lost session — navigating away would swallow it.
    await withStubbedLocation(async (assign) => {
      const error = axiosError(401, '/auth/signin')
      await expect(runRejection(error)).rejects.toBe(error)
      expect(assign).not.toHaveBeenCalled()
    })
  })

  it('does not redirect on a 401 from the anonymous /auth/me probe', async () => {
    await withStubbedLocation(async (assign) => {
      const error = axiosError(401, '/auth/me')
      await expect(runRejection(error)).rejects.toBe(error)
      expect(assign).not.toHaveBeenCalled()
    })
  })

  it('sends any other 401 to signin with the session_ended reason', async () => {
    await withStubbedLocation(async (assign) => {
      const error = axiosError(401, '/expenses')
      await expect(runRejection(error)).rejects.toBe(error)
      expect(assign).toHaveBeenCalledWith('/signin?error=session_ended')
    })
  })
})
