import type { ReactNode } from 'react'

export interface StripFigure {
  id: string
  key: string
  value: string
  note?: string | null
  /** `delta` tints the note as a movement worth noticing rather than context. */
  tone?: 'muted' | 'delta'
  sub?: string
  /** A name rather than a figure: sized down so a long one survives. */
  isText?: boolean
  /** Nothing to report yet. Renders quiet, so a dash never looks like a total. */
  isNil?: boolean
  /**
   * The figure has not arrived. Without it the cells printed `IDR 0` until
   * the response landed, which is a claim about the household's money rather
   * than a wait. It renders as the same quiet dash `isNil` does: both mean
   * "no figure here", and a spinner inside a figure cell is noise.
   */
  isLoading?: boolean
}

interface Props {
  /** Names the region for assistive tech and heads the strip. */
  label: string
  /** Controls that belong beside the title — the month stepper, scope chips. */
  children?: ReactNode
  figures: StripFigure[]
}

/**
 * The dark plate a ledger's month figures sit on.
 *
 * The one place in the app where the ground goes dark, which is what makes the
 * figures on it the first thing read. Shared by the expense count and the
 * income strip because their anatomy is identical — title, controls, four
 * cells — and only their content differs; two copies of this gradient is how
 * the two ledgers would drift a pixel apart every time either was touched.
 */
export const StripShell = ({ label, children, figures }: Props) => (
  <section
    aria-label={label}
    className="strip-shadow rounded-2xl p-4 sm:p-5"
    style={{
      background: 'linear-gradient(178deg, var(--strip-from), var(--strip-to))',
    }}
  >
    <div className="mb-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-2">
      <h2 className="font-display text-strip-key text-[10px] font-bold tracking-[0.15em] uppercase">
        {label}
      </h2>
      {children}
    </div>

    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/15 lg:grid-cols-4">
      {figures.map((figure) => (
        <div key={figure.id} className="bg-strip-cell min-w-0 p-3 sm:p-3.5">
          <dt className="text-on-strip-muted text-[9px] font-bold tracking-[0.11em] uppercase">
            {figure.key}
          </dt>
          <dd
            // A truncated name is unreadable without its full text somewhere,
            // and only a name can be long enough to truncate.
            title={figure.isText ? figure.value : undefined}
            className={`font-display tnum mt-1.5 truncate text-xl font-bold sm:text-[22px] ${
              figure.isNil || figure.isLoading
                ? 'text-on-strip-muted'
                : 'text-on-strip'
            } ${figure.isText ? 'sm:text-[19px]' : ''}`}
          >
            {figure.isLoading ? '—' : figure.value}
          </dd>
          {!figure.isLoading && figure.note && (
            <p
              className={`mt-1 truncate text-[10.5px] font-semibold ${
                figure.tone === 'delta' ? 'text-delta' : 'text-on-strip-muted'
              }`}
            >
              {figure.note}
            </p>
          )}
          {!figure.isLoading && figure.sub && (
            <p className="text-on-strip-muted truncate text-[10.5px] font-semibold">
              {figure.sub}
            </p>
          )}
        </div>
      ))}
    </dl>
  </section>
)
