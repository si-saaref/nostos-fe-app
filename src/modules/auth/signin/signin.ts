import axios from 'axios'
import { LandingReason, SigninError } from '@/modules/auth/types/auth'
import type { Landing } from '@/modules/auth/types/auth'

/**
 * Signin behaviour, kept apart from any scene so all of them share one rule
 * set. Everything here is pure: no network, no React, no DOM.
 */

/** From the API doc: the link is single-use and short-lived. */
export const LINK_TTL_MINUTES = 15

/** From the API doc: 3 requests per address per hour. */
export const MAX_REQUESTS_PER_HOUR = 3

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

const LANDING_BY_ERROR: Record<string, LandingReason> = {
  invalid_link: LandingReason.EXPIRED_LINK,
  session_ended: LandingReason.SESSION_ENDED,
  household_unavailable: LandingReason.HOUSEHOLD_UNAVAILABLE,
  already_in_household: LandingReason.ALREADY_IN_HOUSEHOLD,
}

export const landingFromParams = (params: URLSearchParams): Landing | null => {
  if (params.get('household') === 'deletion_pending') {
    const until = params.get('until')
    // `until` is URL text rendered as a date. Without a valid one the modal
    // would open saying nothing, so fall back to the generic notice.
    return until && ISO_DAY.test(until)
      ? { reason: LandingReason.DELETION_PENDING, until }
      : { reason: LandingReason.HOUSEHOLD_UNAVAILABLE }
  }

  const error = params.get('error')
  const reason = error ? LANDING_BY_ERROR[error] : undefined
  return reason ? { reason } : null
}

const statusOf = (error: unknown): number | undefined =>
  axios.isAxiosError(error) ? error.response?.status : undefined

export const signinErrorFromResponse = (error: unknown): SigninError => {
  switch (statusOf(error)) {
    case 400:
      return SigninError.FORMAT
    case 401:
      return SigninError.NOT_INVITED
    case 429:
      return SigninError.RATE_LIMITED
    default:
      return SigninError.NETWORK
  }
}

/**
 * The 403 is not an inline error — it opens the deletion modal, and the modal
 * is useless without this date.
 */
export const deletionDeadlineFromResponse = (error: unknown): string | null => {
  if (statusOf(error) !== 403) return null
  const data = axios.isAxiosError(error)
    ? (error.response?.data as
        { details?: { deletion_scheduled_for?: string } } | undefined)
    : undefined
  return data?.details?.deletion_scheduled_for ?? null
}
