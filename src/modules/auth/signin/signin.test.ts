import { AxiosError } from 'axios'
import {
  deletionDeadlineFromResponse,
  landingFromParams,
  signinErrorFromResponse,
} from '@/modules/auth/signin/signin'
import { LandingReason, SigninError } from '@/modules/auth/types/auth'

const params = (query: string) => new URLSearchParams(query)

/** A real AxiosError — the mappers guard on `axios.isAxiosError`. */
const axiosError = (status?: number, data?: unknown): AxiosError => {
  const error = new AxiosError('Request failed', 'ERR_BAD_RESPONSE')
  if (status !== undefined) {
    error.response = { status, data } as AxiosError['response']
  }
  return error
}

describe('landingFromParams', () => {
  it('returns null for a clean arrival', () => {
    expect(landingFromParams(params(''))).toBeNull()
  })

  it.each([
    ['error=invalid_link', LandingReason.EXPIRED_LINK],
    ['error=session_ended', LandingReason.SESSION_ENDED],
    ['error=household_unavailable', LandingReason.HOUSEHOLD_UNAVAILABLE],
    ['error=already_in_household', LandingReason.ALREADY_IN_HOUSEHOLD],
  ])('reads %s', (query, reason) => {
    expect(landingFromParams(params(query))).toEqual({ reason })
  })

  it('reads the deletion grace with its deadline', () => {
    expect(
      landingFromParams(params('household=deletion_pending&until=2026-09-26')),
    ).toEqual({ reason: LandingReason.DELETION_PENDING, until: '2026-09-26' })
  })

  it('falls back to unavailable when the deadline is missing', () => {
    // The modal is a deadline and nothing else, so one without a date would be
    // a dialog that says nothing.
    expect(landingFromParams(params('household=deletion_pending'))).toEqual({
      reason: LandingReason.HOUSEHOLD_UNAVAILABLE,
    })
  })

  it('falls back to unavailable when the deadline is malformed', () => {
    expect(
      landingFromParams(
        params('household=deletion_pending&until=next+tuesday'),
      ),
    ).toEqual({ reason: LandingReason.HOUSEHOLD_UNAVAILABLE })
  })

  it('ignores an unknown error code', () => {
    expect(landingFromParams(params('error=who_knows'))).toBeNull()
  })
})

describe('signinErrorFromResponse', () => {
  it.each([
    [400, SigninError.FORMAT],
    [401, SigninError.NOT_INVITED],
    [429, SigninError.RATE_LIMITED],
    [500, SigninError.NETWORK],
  ])('maps %i', (status, expected) => {
    expect(signinErrorFromResponse(axiosError(status))).toBe(expected)
  })

  it('maps a request that never got a response', () => {
    expect(signinErrorFromResponse(axiosError())).toBe(SigninError.NETWORK)
  })
})

describe('deletionDeadlineFromResponse', () => {
  it('reads the deadline out of a 403', () => {
    const error = axiosError(403, {
      details: { deletion_scheduled_for: '2026-09-26' },
    })
    expect(deletionDeadlineFromResponse(error)).toBe('2026-09-26')
  })

  it('returns null for any other status', () => {
    expect(deletionDeadlineFromResponse(axiosError(401))).toBeNull()
  })

  it('returns null when a 403 carries no deadline', () => {
    expect(deletionDeadlineFromResponse(axiosError(403, {}))).toBeNull()
  })
})
