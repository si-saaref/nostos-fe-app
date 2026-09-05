export const SigninError = {
  FORMAT: 'format',
  NOT_INVITED: 'not_invited',
  RATE_LIMITED: 'rate_limited',
  NETWORK: 'network',
} as const
export type SigninError = (typeof SigninError)[keyof typeof SigninError]

export const LandingReason = {
  EXPIRED_LINK: 'expired_link',
  SESSION_ENDED: 'session_ended',
  HOUSEHOLD_UNAVAILABLE: 'household_unavailable',
  ALREADY_IN_HOUSEHOLD: 'already_in_household',
  DELETION_PENDING: 'deletion_pending',
} as const
export type LandingReason = (typeof LandingReason)[keyof typeof LandingReason]

/** Why the visitor was bounced back here, read from the URL. */
export interface Landing {
  reason: LandingReason
  /** DELETION_PENDING only: the YYYY-MM-DD deadline from `until`. */
  until?: string
}
