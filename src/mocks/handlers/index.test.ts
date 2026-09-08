import { buildHandlers, isLiveApiPath } from '@/mocks/handlers'
import type { MockedDomains } from '@/mocks/handlers'

const ALL_LIVE: MockedDomains = { auth: false, expense: false, prefs: false }
const ALL_MOCKED: MockedDomains = { auth: true, expense: true, prefs: true }

/** Assert on paths, not counts. `path` needs narrowing off the union. */
const paths = (handlers: ReturnType<typeof buildHandlers>): string[] =>
  handlers.map((handler) => String((handler.info as { path?: unknown }).path))

describe('buildHandlers', () => {
  it('registers nothing when every domain is live', () => {
    expect(buildHandlers(ALL_LIVE)).toEqual([])
  })

  it('mocks expenses, both reference lists and members as one domain', () => {
    const registered = paths(buildHandlers({ ...ALL_LIVE, expense: true }))
    expect(registered).toEqual(
      expect.arrayContaining([
        '*/api/v1/expenses',
        '*/api/v1/expense-types',
        '*/api/v1/payment-sources',
        '*/api/v1/households/:id/members',
      ]),
    )
    expect(registered.some((path) => path.endsWith('/prefs'))).toBe(false)
  })

  it('mocks each other domain on its own', () => {
    expect(paths(buildHandlers({ ...ALL_LIVE, prefs: true }))).toEqual([
      '*/api/v1/households/:id/prefs',
      '*/api/v1/households/:id/prefs',
    ])
    expect(
      paths(buildHandlers({ ...ALL_LIVE, auth: true })).every((path) =>
        path.includes('/auth/'),
      ),
    ).toBe(true)
  })
})

describe('isLiveApiPath', () => {
  it.each([
    '/api/v1/expenses',
    '/api/v1/expenses/8c14e2a0-5b73-4f19-9d62-0a3e7c81f45b',
    '/api/v1/expense-types',
    '/api/v1/payment-sources/7a2e',
    '/api/v1/households/1f0c/members',
    '/api/v1/households/1f0c/members/9b4d/resend-invite',
    '/api/v1/auth/me',
    '/api/v1/households/1f0c/prefs',
  ])(
    'reports %s as reaching the real backend when its domain is live',
    (pathname) => {
      expect(isLiveApiPath(pathname, ALL_LIVE)).toBe(true)
    },
  )

  it('reports nothing as live when every domain is mocked', () => {
    expect(isLiveApiPath('/api/v1/expenses', ALL_MOCKED)).toBe(false)
    expect(isLiveApiPath('/api/v1/auth/me', ALL_MOCKED)).toBe(false)
    expect(isLiveApiPath('/api/v1/households/1f0c/prefs', ALL_MOCKED)).toBe(
      false,
    )
  })

  // A domain still mocked must not be reported live because a neighbour is.
  it('answers per domain, not per request', () => {
    const mocked: MockedDomains = { auth: false, expense: true, prefs: true }
    expect(isLiveApiPath('/api/v1/auth/me', mocked)).toBe(true)
    expect(isLiveApiPath('/api/v1/expenses', mocked)).toBe(false)
    expect(isLiveApiPath('/api/v1/households/1f0c/prefs', mocked)).toBe(false)
  })

  it('does not mistake a members path for a prefs path', () => {
    const mocked: MockedDomains = { auth: true, expense: true, prefs: false }
    expect(isLiveApiPath('/api/v1/households/1f0c/members', mocked)).toBe(false)
  })
})
