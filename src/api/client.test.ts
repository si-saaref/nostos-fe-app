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
        totals: { sum: '100.00', count: 1, average: '100.00' },
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
        totals: { sum: '100.00', count: 1, average: '100.00' },
        summary: { current: { sum: '250.00', count: 2, average: '125.00' } },
      }),
      (row) => row,
    )
    expect(page.totals?.sum).toBe(250)
    expect(page.totals?.sumText).toBe('250.00')
  })

  it('renames the nested wire keys and nothing else', () => {
    const page = unwrapPage(
      respond({
        pagination: PAGINATION,
        summary: {
          current: { sum: '250.00', count: 2, average: '125.00' },
          previous: { sum: '90.00', count: 1, average: '90.00' },
          breakdown: {
            by_type: [{ id: 'type-a', sum: '250.00', count: 2 }],
            by_member: [{ id: 'user-a', sum: '250.00', count: 2 }],
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

it('preserves exact BE cumulative, withdrawal and comparison values across partial pages', () => {
  const response = {
    data: {
      success: true,
      data: [],
      meta: {
        pagination: { page: 1, limit: 1, total: 100, total_pages: 100 },
        summary: {
          current: {
            sum: '61215500.00',
            count: 100,
            average: '612155.00',
            cash_withdrawn: '100.30',
            cash_withdrawal_count: 2,
          },
          daily: [
            {
              date: '2026-10-01',
              sum: '30000.00',
              count: 1,
              cumulative: '30000.00',
            },
            {
              date: '2026-10-24',
              sum: '61185500.00',
              count: 99,
              cumulative: '61215500.00',
            },
          ],
          comparison: { percentage: '0.0', direction: 'flat' },
        },
      },
    },
  } as unknown as AxiosResponse<ApiEnvelope<unknown[]>>
  const page = unwrapPage(response, (row) => row)
  expect(page.summary?.daily?.[1]).toMatchObject({
    date: '2026-10-24',
    cumulativeText: '61215500.00',
  })
  expect(page.totals).toMatchObject({
    cash_withdrawn: 100.3,
    cashWithdrawnText: '100.30',
    cash_withdrawal_count: 2,
  })
  expect(page.summary?.comparison).toEqual({
    percentage: '0.0',
    direction: 'flat',
  })
})
