import { useEffect, useId, useRef, useState } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { Logo } from '@/components/Logo'
import {
  LINK_TTL_MINUTES,
  MAX_REQUESTS_PER_HOUR,
  isAsciiEmail,
  submitSignin,
} from '@/modules/auth/signin/machine'
import type {
  LandingReason,
  SigninErrorKind,
  SigninState,
} from '@/modules/auth/signin/machine'

interface Props {
  landing: LandingReason
  /** Scenes that already show the mark in their own chrome suppress it here. */
  showLogo?: boolean
  align?: 'left' | 'center'
}

/**
 * The whole of signin's behaviour, in one card.
 *
 * Scenes own layout and ornament and nothing else — they render this. That is
 * what keeps three login screens from becoming three auth implementations that
 * drift apart.
 */
export const SigninCard = ({
  landing,
  showLogo = true,
  align = 'left',
}: Props) => {
  const m = useMessages()
  const fieldId = useId()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<SigninState>({ kind: 'idle' })
  const sentHeading = useRef<HTMLParagraphElement>(null)

  // The form is gone once the link is sent, so focus has to go somewhere real
  // or a screen-reader user is left on a button that no longer exists.
  useEffect(() => {
    if (state.kind === 'sent') sentHeading.current?.focus()
  }, [state.kind])

  const send = async (address: string, used: number) => {
    setState({ kind: 'sending' })
    const result = await submitSignin(address)
    if (result.ok) {
      setState({ kind: 'sent', email: address, used })
    } else {
      setState({ kind: 'idle', error: result.error })
    }
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!isAsciiEmail(email)) {
      setState({ kind: 'idle', error: 'format' })
      return
    }
    void send(email, 1)
  }

  const errorText: Record<SigninErrorKind, string> = {
    format: m.signin_err_format(),
    not_invited: m.signin_err_not_invited(),
    rate_limited: m.signin_err_rate(),
    network: m.signin_err_network(),
  }

  const centred = align === 'center'

  if (state.kind === 'sent') {
    const left = MAX_REQUESTS_PER_HOUR - state.used
    return (
      <div className={centred ? 'text-center' : ''}>
        {showLogo && (
          <div className={centred ? 'flex justify-center' : ''}>
            <Logo />
          </div>
        )}

        <span
          aria-hidden="true"
          className="well-shadow bg-chip mt-5 grid h-10 w-10 place-items-center rounded-xl text-[15px]"
          style={centred ? { marginInline: 'auto' } : undefined}
        >
          ✉
        </span>

        <p
          ref={sentHeading}
          tabIndex={-1}
          className="font-display mt-3 text-[19px] font-bold outline-none"
        >
          {m.sent_title()}
        </p>
        <p className="text-muted mt-1.5 text-[11.5px] leading-relaxed">
          {m.sent_body({ email: state.email, n: LINK_TTL_MINUTES })}
        </p>

        {left > 0 ? (
          <button
            type="button"
            onClick={() => void send(state.email, state.used + 1)}
            className="border-hair text-ink mt-3.5 w-full rounded-lg border px-3 py-2 text-[11.5px] font-semibold"
          >
            {m.sent_resend()} · {m.sent_resend_left({ n: left })}
          </button>
        ) : (
          <p className="bg-chip text-muted mt-3.5 rounded-lg px-3 py-2 text-[11px]">
            {m.sent_resend_none()}
          </p>
        )}

        <p className="text-muted mt-2.5 text-[11px]">
          {m.sent_wrong()}{' '}
          <button
            type="button"
            onClick={() => setState({ kind: 'idle' })}
            className="text-ink font-semibold underline underline-offset-2"
          >
            {m.sent_change()}
          </button>
        </p>
      </div>
    )
  }

  const sending = state.kind === 'sending'
  const error = state.kind === 'idle' ? state.error : undefined

  return (
    <div className={centred ? 'text-center' : ''}>
      {showLogo && (
        <div className={centred ? 'flex justify-center' : ''}>
          <Logo />
        </div>
      )}

      {landing && (
        <div role="status" className="bg-chip mt-4 rounded-lg px-3 py-2.5">
          <p className="text-[12px] font-semibold">
            {landing === 'expired_link'
              ? m.land_expired_title()
              : m.land_ended_title()}
          </p>
          <p className="text-muted mt-1 text-[11px] leading-relaxed">
            {landing === 'expired_link'
              ? m.land_expired_body()
              : m.land_ended_body()}
          </p>
        </div>
      )}

      <h1 className="font-display mt-5 text-[26px] leading-none font-bold">
        {m.signin_title()}
      </h1>
      <p className="text-muted mt-2 text-[11.5px] leading-relaxed">
        {m.signin_lede()}
      </p>

      {/* noValidate: native constraint validation refuses a non-ASCII address
          without ever running our own rule, so the user would be told nothing. */}
      <form onSubmit={onSubmit} noValidate className="mt-4">
        <label
          htmlFor={fieldId}
          className={`text-muted block text-[9px] font-bold tracking-[0.12em] uppercase ${
            centred ? 'text-center' : ''
          }`}
        >
          {m.signin_email()}
        </label>
        <input
          id={fieldId}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={m.signin_email_ph()}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className={`well-shadow bg-chip text-ink placeholder:text-muted mt-1.5 w-full rounded-lg px-3 py-2.5 text-[12.5px] outline-none ${
            error ? 'ring-danger ring-2' : ''
          } ${centred ? 'text-center' : ''}`}
        />

        {error && (
          <p
            id={`${fieldId}-error`}
            role="alert"
            className="border-danger-line bg-danger-bg text-danger mt-2 rounded-lg border px-3 py-2 text-[11px] leading-relaxed"
          >
            {errorText[error]}
          </p>
        )}

        <button
          type="submit"
          disabled={sending}
          className="bg-accent text-accent-ink mt-3 w-full rounded-lg px-4 py-2.5 text-[12.5px] font-semibold disabled:opacity-60"
        >
          {sending ? m.signin_sending() : m.signin_cta()}
        </button>
      </form>

      <p className="text-muted mt-3 text-[10.5px] leading-relaxed">
        {m.signin_expiry({ n: LINK_TTL_MINUTES })} {m.signin_invited_only()}
      </p>
    </div>
  )
}
