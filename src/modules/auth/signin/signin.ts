import type { LandingReason, SigninResult } from '@/modules/auth/types/auth'

/**
 * Signin behaviour, kept apart from any scene so all of them share one rule set.
 *
 * SLICING PASS: nothing here talks to the network yet. `submitSignin` is the
 * single seam the integration session replaces with the real
 * `POST /api/v1/auth/signin` — note the `v1`, which the app's current axios
 * baseURL (`/api`) does not carry.
 */

/** From the API doc: the link is single-use and short-lived. */
export const LINK_TTL_MINUTES = 15

/** From the API doc: 3 requests per address per hour. */
export const MAX_REQUESTS_PER_HOUR = 3

export const landingFromParams = (params: URLSearchParams): LandingReason => {
  const error = params.get('error')
  if (error === 'invalid_link') return 'expired_link'
  if (error === 'session_ended') return 'session_ended'
  return null
}

/**
 * The integration seam.
 *
 * Until the real endpoint is wired, this resolves locally so the screen and all
 * of its states can be reviewed without a backend. Two addresses drive the
 * unhappy paths on demand:
 *
 *   anything containing "belum"   → 401, not invited
 *   anything containing "limit"   → 429, rate limited
 *
 * Replace the whole function; the component contract is just this signature.
 */
export const submitSignin = async (email: string): Promise<SigninResult> => {
  await new Promise((resolve) => setTimeout(resolve, 600))
  if (email.includes('belum')) return { ok: false, error: 'not_invited' }
  if (email.includes('limit')) return { ok: false, error: 'rate_limited' }
  return { ok: true }
}
