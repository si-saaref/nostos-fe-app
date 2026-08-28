import { apiClient, setHouseholdId } from '@/api/client'

describe('apiClient', () => {
  it('is configured to send credentials', () => {
    expect(apiClient.defaults.withCredentials).toBe(true)
  })

  it('attaches X-Household-ID via the request interceptor after setHouseholdId', async () => {
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

  it('does not redirect on a 401 from the anonymous session probe', async () => {
    // jsdom's window.location.assign is non-configurable, so vi.spyOn can't
    // wrap it directly — swap in a stub Location instead.
    const originalLocation = window.location
    const assign = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: originalLocation.pathname, assign },
    })

    try {
      // Run the response interceptor's rejection handler manually against a
      // synthetic 401 error shaped like the anon session probe's response.
      const handlers = apiClient.interceptors.response as unknown as {
        handlers: { rejected: (e: unknown) => Promise<never> }[]
      }
      const rejected = handlers.handlers[0].rejected
      const error = {
        response: { status: 401 },
        config: { url: '/api/auth/session' },
      }

      await expect(rejected(error)).rejects.toBe(error)
      expect(assign).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      })
    }
  })
})
