import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMessages } from '@/i18n/useMessages'
import { Logo } from '@/components/Logo'
import { useRequestSigninLink } from '@/modules/auth/api/signin'
import {
  LINK_TTL_MINUTES,
  MAX_REQUESTS_PER_HOUR,
  deletionDeadlineFromResponse,
  signinErrorFromResponse,
} from '@/modules/auth/signin/signin'
import { HouseholdDeletionModal } from '@/modules/auth/signin/HouseholdDeletionModal'
import { isAsciiEmail } from '@/utils/validators'
import { LandingReason, SigninError } from '@/modules/auth/types/auth'
import type { Landing } from '@/modules/auth/types/auth'

interface Props {
  landing: Landing | null
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
  const [formatError, setFormatError] = useState(false)
  // The latch. TanStack flips `isSuccess` back to false the moment a resend
  // starts, so the sent view cannot be keyed on it — this counter both holds
  // the view and drives the "n left" copy.
  const [sendsUsed, setSendsUsed] = useState(0)
  // Two entry points, one piece of state: the URL the redirect landed on, and
  // a 403 from the request below.
  const [deletionDeadline, setDeletionDeadline] = useState<string | null>(
    landing?.reason === LandingReason.DELETION_PENDING
      ? (landing.until ?? null)
      : null,
  )
  const sentHeading = useRef<HTMLParagraphElement>(null)
  const navigate = useNavigate()

  const request = useRequestSigninLink()

  // The form is gone once the link is sent, so focus has to go somewhere real
  // or a screen-reader user is left on a button that no longer exists.
  useEffect(() => {
    if (sendsUsed > 0) sentHeading.current?.focus()
  }, [sendsUsed])

  const send = (address: string) => {
    setFormatError(false)
    request.mutate(address, {
      onSuccess: () => setSendsUsed((used) => used + 1),
      onError: (failure) => {
        const deadline = deletionDeadlineFromResponse(failure)
        if (deadline) setDeletionDeadline(deadline)
      },
    })
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!isAsciiEmail(email)) {
      setFormatError(true)
      return
    }
    send(email)
  }

  const changeEmail = () => {
    request.reset()
    setSendsUsed(0)
    setFormatError(false)
  }

  const errorText: Record<SigninError, string> = {
    [SigninError.FORMAT]: m.signin_err_format(),
    [SigninError.NOT_INVITED]: m.signin_err_not_invited(),
    [SigninError.RATE_LIMITED]: m.signin_err_rate(),
    [SigninError.NETWORK]: m.signin_err_network(),
  }

  // A 403 opens the modal instead; rendering it inline as well would say the
  // same thing twice, in two different registers.
  const error = formatError
    ? SigninError.FORMAT
    : request.error && !deletionDeadlineFromResponse(request.error)
      ? signinErrorFromResponse(request.error)
      : undefined

  const isSending = request.isPending
  const sentEmail = request.variables ?? email
  const centred = align === 'center'

  if (sendsUsed > 0) {
    const resendsLeft = MAX_REQUESTS_PER_HOUR - sendsUsed
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
          {m.sent_body({ email: sentEmail, n: LINK_TTL_MINUTES })}
        </p>

        {/* A refused resend has to say so here. The client-side counter resets
            on reload while the server's hour does not, so the UI will sometimes
            offer a send the API turns down. */}
        {error && (
          <p
            role="alert"
            className="border-danger-line bg-danger-bg text-danger mt-3.5 rounded-lg border px-3 py-2 text-[11px] leading-relaxed"
          >
            {errorText[error]}
          </p>
        )}

        {resendsLeft > 0 && !error ? (
          <button
            type="button"
            disabled={isSending}
            onClick={() => send(sentEmail)}
            className="border-hair text-ink mt-3.5 w-full rounded-lg border px-3 py-2 text-[11.5px] font-semibold disabled:opacity-60"
          >
            {isSending
              ? m.signin_sending()
              : `${m.sent_resend()} · ${m.sent_resend_left({ n: resendsLeft })}`}
          </button>
        ) : (
          !error && (
            <p className="bg-chip text-muted mt-3.5 rounded-lg px-3 py-2 text-[11px]">
              {m.sent_resend_none()}
            </p>
          )
        )}

        <p className="text-muted mt-2.5 text-[11px]">
          {m.sent_wrong()}{' '}
          <button
            type="button"
            onClick={changeEmail}
            className="text-ink font-semibold underline underline-offset-2"
          >
            {m.sent_change()}
          </button>
        </p>

        <HouseholdDeletionModal
          deadline={deletionDeadline}
          onDismiss={() => {
            setDeletionDeadline(null)
            // Strip the query string, or a reload reopens the modal and the
            // dismiss reads as broken.
            if (landing?.reason === LandingReason.DELETION_PENDING) {
              navigate('/signin', { replace: true })
            }
          }}
        />
      </div>
    )
  }

  return (
    <div className={centred ? 'text-center' : ''}>
      {showLogo && (
        <div className={centred ? 'flex justify-center' : ''}>
          <Logo />
        </div>
      )}

      {landing && landing.reason !== LandingReason.DELETION_PENDING && (
        <div role="status" className="bg-chip mt-4 rounded-lg px-3 py-2.5">
          <p className="text-[12px] font-semibold">
            {
              {
                [LandingReason.EXPIRED_LINK]: m.land_expired_title(),
                [LandingReason.SESSION_ENDED]: m.land_ended_title(),
                [LandingReason.HOUSEHOLD_UNAVAILABLE]:
                  m.land_unavailable_title(),
                [LandingReason.ALREADY_IN_HOUSEHOLD]: m.land_already_title(),
              }[landing.reason]
            }
          </p>
          <p className="text-muted mt-1 text-[11px] leading-relaxed">
            {
              {
                [LandingReason.EXPIRED_LINK]: m.land_expired_body(),
                [LandingReason.SESSION_ENDED]: m.land_ended_body(),
                [LandingReason.HOUSEHOLD_UNAVAILABLE]:
                  m.land_unavailable_body(),
                [LandingReason.ALREADY_IN_HOUSEHOLD]: m.land_already_body(),
              }[landing.reason]
            }
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
          htmlFor="signin-email"
          className={`text-muted block text-[9px] font-bold tracking-[0.12em] uppercase ${
            centred ? 'text-center' : ''
          }`}
        >
          {m.signin_email()}
        </label>
        <input
          id="signin-email"
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
          disabled={isSending}
          className="bg-accent text-accent-ink mt-3 w-full rounded-lg px-4 py-2.5 text-[12.5px] font-semibold disabled:opacity-60"
        >
          {isSending ? m.signin_sending() : m.signin_cta()}
        </button>
      </form>

      <p className="text-muted mt-3 text-[10.5px] leading-relaxed">
        {m.signin_expiry({ n: LINK_TTL_MINUTES })} {m.signin_invited_only()}
      </p>

      <HouseholdDeletionModal
        deadline={deletionDeadline}
        onDismiss={() => {
          setDeletionDeadline(null)
          // Strip the query string, or a reload reopens the modal and the
          // dismiss reads as broken.
          if (landing?.reason === LandingReason.DELETION_PENDING) {
            navigate('/signin', { replace: true })
          }
        }}
      />
    </div>
  )
}
