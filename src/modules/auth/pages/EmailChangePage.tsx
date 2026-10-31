import { Link, useLocation } from 'react-router-dom'
import { useHousehold } from '@/contexts/useHousehold'
import { useMessages } from '@/i18n/useMessages'

/** Public because an inbox link may open in a browser without an old session. */
export const EmailChangePage = () => {
  const m = useMessages()
  const { search } = useLocation()
  const { isAuthenticated } = useHousehold()
  const params = new URLSearchParams(search)
  const error = params.get('error')
  const message =
    error === 'email_delivery_failed'
      ? m.email_change_delivery_failed()
      : error === 'address_taken'
        ? m.email_change_address_taken()
        : error === 'invalid_link'
          ? m.email_change_invalid()
          : params.has('email_changed')
            ? m.email_change_done()
            : params.has('email_approval')
              ? m.email_change_approved()
              : m.email_change_unknown()

  return (
    <main className="bg-canvas text-ink flex min-h-screen items-center justify-center px-4">
      <section className="bg-card plate-shadow w-full max-w-md rounded-2xl p-6">
        <p className="text-muted text-[10px] font-bold tracking-[0.14em] uppercase">
          Nostos
        </p>
        <h1 className="font-display mt-3 text-xl font-bold">
          {m.email_change_title()}
        </h1>
        <p
          role="status"
          className="text-muted mt-3 text-[13px] leading-relaxed"
        >
          {message}
        </p>
        <Link
          to={isAuthenticated ? '/settings#profil' : '/signin'}
          className="bg-accent text-accent-ink mt-5 inline-block rounded-lg px-4 py-2 text-[12px] font-semibold"
        >
          {isAuthenticated
            ? m.email_change_settings()
            : m.email_change_signin()}
        </Link>
      </section>
    </main>
  )
}
