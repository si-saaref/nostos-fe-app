export interface LoginInput {
  email: string
  password: string
}

export type SigninErrorKind =
  'format' | 'not_invited' | 'rate_limited' | 'network'

export type SigninState =
  | { kind: 'idle'; error?: SigninErrorKind }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string; sendsUsed: number; isResending?: boolean }

/** Why the visitor was bounced back here, read from the URL. */
export type LandingReason = 'expired_link' | 'session_ended' | null

export interface SigninResult {
  ok: boolean
  error?: SigninErrorKind
}
