import { useRef, useState, type ReactNode } from 'react'
import { useMessages } from '@/i18n/useMessages'

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
export const StripShell = ({ label, children, figures }: Props) => {
  const m = useMessages()
  const [active, setActive] = useState(0)
  const track = useRef<HTMLDListElement>(null)
  const move = (delta: number) => {
    const index = Math.max(0, Math.min(figures.length - 1, active + delta))
    setActive(index)
    track.current?.children[index]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'start',
    })
  }
  return (
    <section
      aria-label={label}
      className="strip-shadow rounded-2xl p-4 sm:p-5"
      style={{
        background:
          'linear-gradient(178deg, var(--strip-from), var(--strip-to))',
      }}
    >
      <div className="mb-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <h2 className="font-display text-strip-key text-[10px] font-bold tracking-[0.15em] uppercase">
          {label}
        </h2>
        {children}
      </div>

      <div className="mb-2 flex items-center justify-end gap-3 lg:hidden">
        <button
          type="button"
          aria-label={m.metric_previous()}
          disabled={active === 0}
          onClick={() => move(-1)}
          className="text-on-strip min-h-11 min-w-11 rounded-lg disabled:opacity-40"
        >
          ←
        </button>
        <span role="status" className="text-on-strip-muted text-xs">
          {active + 1} / {figures.length}
        </span>
        <button
          type="button"
          aria-label={m.metric_next()}
          disabled={active === figures.length - 1}
          onClick={() => move(1)}
          className="text-on-strip min-h-11 min-w-11 rounded-lg disabled:opacity-40"
        >
          →
        </button>
      </div>
      <dl
        ref={track}
        onScroll={() => {
          const el = track.current
          if (el && el.children[0])
            setActive(
              Math.min(
                figures.length - 1,
                Math.round(
                  el.scrollLeft / el.children[0].getBoundingClientRect().width,
                ),
              ),
            )
        }}
        className="flex snap-x snap-mandatory gap-px overflow-x-auto rounded-xl bg-white/15 lg:grid lg:grid-cols-4 lg:overflow-visible"
      >
        {figures.map((figure) => (
          <div
            key={figure.id}
            className="bg-strip-cell min-w-0 shrink-0 basis-[86%] snap-start p-3 sm:p-3.5"
          >
            <dt className="text-on-strip-muted text-[9px] font-bold tracking-[0.11em] uppercase">
              {figure.key}
            </dt>
            <dd
              // A break-wordsd name is unreadable without its full text somewhere,
              // and only a name can be long enough to break-words.
              title={figure.isText ? figure.value : undefined}
              className={`font-display tnum mt-1.5 text-xl font-bold break-words sm:text-[22px] ${
                figure.isNil || figure.isLoading
                  ? 'text-on-strip-muted'
                  : 'text-on-strip'
              } ${figure.isText ? 'sm:text-[19px]' : ''}`}
            >
              {figure.isLoading ? '—' : figure.value}
            </dd>
            {!figure.isLoading && figure.note && (
              <p
                className={`mt-1 text-[10.5px] font-semibold break-words ${
                  figure.tone === 'delta' ? 'text-delta' : 'text-on-strip-muted'
                }`}
              >
                {figure.note}
              </p>
            )}
            {!figure.isLoading && figure.sub && (
              <p className="text-on-strip-muted text-[10.5px] font-semibold break-words">
                {figure.sub}
              </p>
            )}
          </div>
        ))}
      </dl>
    </section>
  )
}
