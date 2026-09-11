import type { Mock } from 'vitest'
import { AxiosError } from 'axios'
import type { AxiosResponse } from 'axios'
import { apiClient, setHouseholdId, unwrapPage } from '@/api/client'
import type { ApiEnvelope, ApiMeta } from '@/types/api'

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

interface Row {
  id: string
}

const respond = (meta: ApiMeta): AxiosResponse<ApiEnvelope<Row[]>> =>
  ({
    data: { success: true, data: [{ id: 'a' }], meta },
    config: { url: '/expenses' },
  }) as AxiosResponse<ApiEnvelope<Row[]>>

const PAGINATION = { page: 1, limit: 400, total: 1, total_pages: 1 }

/**
 * `meta.summary` is the block that retires `meta.totals` and the duplicate
 * list calls with it (`notes/FE-App/API-CHANGES-2026-09-10.md`). Its presence
 * is the feature flag, so the two readings have to be exercised separately.
 */
describe('unwrapPage — meta.summary', () => {
  it('reads the legacy totals when no summary is sent', () => {
    const page = unwrapPage(
      respond({
        pagination: PAGINATION,
        totals: { sum: 100, count: 1, average: 100 },
      }),
      (row) => row,
    )
    expect(page.totals?.sum).toBe(100)
    expect(page.summary).toBeUndefined()
  })

  // Both on the wire is a deployment mid-migration, and two figures that can
  // disagree must never both be readable.
  it('prefers summary.current over meta.totals', () => {
    const page = unwrapPage(
      respond({
        pagination: PAGINATION,
        totals: { sum: 100, count: 1, average: 100 },
        summary: { current: { sum: 250, count: 2, average: 125 } },
      }),
      (row) => row,
    )
    expect(page.totals?.sum).toBe(250)
  })

  it('renames the nested wire keys and nothing else', () => {
    const page = unwrapPage(
      respond({
        pagination: PAGINATION,
        summary: {
          current: { sum: 250, count: 2, average: 125 },
          previous: { sum: 90, count: 1, average: 90 },
          breakdown: {
            by_type: [{ id: 'type-a', sum: 250, count: 2 }],
            by_member: [{ id: 'user-a', sum: 250, count: 2 }],
          },
        },
      }),
      (row) => row,
    )
    expect(page.summary?.previous?.sum).toBe(90)
    expect(page.summary?.breakdown?.byType?.[0].id).toBe('type-a')
    expect(page.summary?.breakdown?.byMember?.[0].id).toBe('user-a')
  })

  // Absent is "not computed", never "the household has nothing".
  it('leaves aggregates undefined when meta carries neither', () => {
    const page = unwrapPage(respond({ pagination: PAGINATION }), (row) => row)
    expect(page.totals).toBeUndefined()
    expect(page.summary).toBeUndefined()
  })
})
