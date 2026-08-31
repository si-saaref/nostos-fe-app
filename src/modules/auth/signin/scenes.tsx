import { useMessages } from '@/i18n/useMessages'
import { SigninCard } from '@/modules/auth/signin/SigninCard'
import type { LandingReason } from '@/modules/auth/types/auth'

interface SceneProps {
  landing: LandingReason
}

/* ------------------------------------------------------------------ door */

/**
 * D · The door. A plum field, one quote, one small card — a threshold rather
 * than a page.
 *
 * The ornament is the logo's homecoming arc at enormous scale, cropped by two
 * edges and barely above the ground. Deliberately not an illustration: an
 * object here would compete with the quote, which is the only voice in that
 * half, and it would collapse this scene into the still-life one.
 */
export const DoorScene = ({ landing }: SceneProps) => {
  const m = useMessages()
  return (
    <main
      className="relative grid min-h-screen items-center overflow-hidden px-6 py-10 lg:grid-cols-[1.05fr_.95fr] lg:px-16"
      style={{
        background:
          'linear-gradient(150deg, var(--strip-from), color-mix(in srgb, var(--strip-to) 78%, #000))',
      }}
    >
      {/* Field, not object: decorative, so it never has to carry contrast. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 600 600"
        className="pointer-events-none absolute -top-[22%] -left-[14%] h-[145%] w-auto opacity-[0.07]"
      >
        <path
          d="M470 210a190 190 0 1 0 66 144"
          fill="none"
          stroke="var(--on-strip)"
          strokeWidth="26"
          strokeLinecap="round"
        />
        <circle cx="536" cy="196" r="70" fill="var(--accent)" />
      </svg>

      <div className="relative z-10 order-2 max-w-lg lg:order-1 lg:pr-12">
        <p
          className="font-display text-[10px] font-bold tracking-[0.18em] uppercase"
          style={{ color: 'var(--strip-key)' }}
        >
          {m.signin_kicker()}
        </p>
        <p
          className="font-display mt-3 text-[19px] leading-[1.3] font-bold lg:text-[32px] lg:leading-[1.28]"
          style={{ color: 'var(--on-strip)' }}
        >
          {m.quote_buffett()}
        </p>
        <p
          className="mt-3 text-[11px]"
          style={{ color: 'var(--on-strip-muted)' }}
        >
          {m.quote_buffett_by()}
        </p>
      </div>

      <div className="relative z-10 order-1 mb-8 w-full max-w-[380px] lg:order-2 lg:mb-0 lg:justify-self-end">
        <div className="bg-card rounded-2xl p-6 shadow-[0_30px_60px_-24px_rgba(0,0,0,.6)]">
          <SigninCard landing={landing} />
        </div>
      </div>
    </main>
  )
}

/* ------------------------------------------------------------- still life */

/** A · Split card on a plum ground, with line art of the household's objects. */
export const StillLifeScene = ({ landing }: SceneProps) => {
  const m = useMessages()
  return (
    <main
      className="grid min-h-screen place-items-center p-5 lg:p-10"
      style={{
        background:
          'linear-gradient(160deg, var(--strip-from), var(--strip-to))',
      }}
    >
      <div className="bg-card grid w-full max-w-5xl overflow-hidden rounded-2xl shadow-[0_30px_60px_-24px_rgba(0,0,0,.55)] lg:grid-cols-2">
        <div className="p-7 lg:p-9">
          <SigninCard landing={landing} />
        </div>

        <div className="bg-ground hidden flex-col justify-between p-8 lg:flex">
          <div>
            <span className="text-accent font-display block text-[26px] leading-[0.6] font-bold">
              “
            </span>
            <p className="font-display mt-3 text-[17px] leading-[1.4] font-semibold">
              {m.quote_proverb()}
            </p>
            <p className="text-muted mt-2 text-[10.5px]">
              {m.quote_proverb_by()}
            </p>
          </div>

          <svg
            viewBox="0 0 300 180"
            aria-hidden="true"
            className="mt-8 w-full"
            fill="none"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <ellipse cx="88" cy="140" rx="62" ry="15" stroke="var(--rim-1)" />
            <ellipse cx="88" cy="127" rx="55" ry="13" stroke="var(--rim-1)" />
            <ellipse cx="88" cy="115" rx="47" ry="11" stroke="var(--rim-4)" />
            <path
              d="M196 146h72a5 5 0 0 0 5-5V88a5 5 0 0 0-5-5h-72a5 5 0 0 0-5 5v53a5 5 0 0 0 5 5z"
              stroke="var(--rim-2)"
            />
            <path d="M191 100h82M226 83v-9h12v9" stroke="var(--rim-2)" />
            <circle cx="152" cy="62" r="17" stroke="var(--accent)" />
            <path d="M152 45c7 6 7 11 0 17" stroke="var(--accent)" />
            <path d="M60 84c0-11 9-19 21-19s21 8 21 19" stroke="var(--rim-3)" />
          </svg>
        </div>
      </div>
    </main>
  )
}

/* ----------------------------------------------------------------- ledger */

/** B · Split card whose right half is a quieted fragment of the real product. */
export const LedgerScene = ({ landing }: SceneProps) => {
  const m = useMessages()

  const rows: Array<{ name: string; amount: string; rim: string }> = [
    { name: 'Sayur & buah pasar', amount: 'Rp 87.000', rim: 'bg-rim-1' },
    { name: 'Token listrik', amount: 'Rp 177.000', rim: 'bg-rim-2' },
    { name: 'Ojek ke kantor', amount: 'Rp 24.000', rim: 'bg-rim-3' },
    { name: 'Kopi & gorengan', amount: 'Rp 23.000', rim: 'bg-rim-4' },
  ]

  return (
    <main
      className="grid min-h-screen place-items-center p-5 lg:p-10"
      style={{
        background:
          'linear-gradient(160deg, var(--strip-from), var(--strip-to))',
      }}
    >
      <div className="bg-card grid w-full max-w-5xl overflow-hidden rounded-2xl shadow-[0_30px_60px_-24px_rgba(0,0,0,.55)] lg:grid-cols-2">
        <div className="p-7 lg:p-9">
          <SigninCard landing={landing} />
        </div>

        <div className="bg-ground relative hidden overflow-hidden py-8 pl-8 lg:block">
          {/* Labelled, because invented figures must never read as a real household's. */}
          <span className="bg-chip text-muted absolute top-6 right-6 rounded-full px-2.5 py-1 text-[8px] font-bold tracking-[0.09em] uppercase">
            {m.sample_badge()}
          </span>

          <p className="font-display mr-8 text-[15px] leading-[1.4] font-semibold">
            {m.quote_ledger()}
          </p>

          <div className="mt-6 pr-6" aria-hidden="true">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-display text-[9.5px] font-bold tracking-[0.1em]">
                JUM · 28 AGU
              </span>
              <span className="bg-bar h-0.5 flex-1 rounded-full opacity-50" />
              <span className="text-[9.5px] font-semibold">186.400</span>
            </div>

            {rows.map((row) => (
              <div
                key={row.name}
                className="bg-card plate-shadow relative mb-1.5 flex h-9 items-center gap-2 overflow-hidden rounded-lg px-3"
              >
                <span
                  className={`absolute inset-y-0 left-0 w-[3px] ${row.rim}`}
                />
                <span className="flex-1 pl-1 text-[11px] font-medium">
                  {row.name}
                </span>
                <span className="text-[11px] font-semibold">{row.amount}</span>
              </div>
            ))}
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
            style={{
              background: 'linear-gradient(180deg, transparent, var(--ground))',
            }}
          />
        </div>
      </div>
    </main>
  )
}
