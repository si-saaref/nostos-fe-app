import { useMemo } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/utils/formatters'
import { eachDayDescending, fromIsoDay, isoDay } from '@/utils/dates'
import type { DayTotal } from '@/modules/financial/types/ledger'

interface Props {
  /** Days that carry expenses, newest first, matching the tape. */
  days: DayTotal[]
  /** The scope's own range, so the rail can draw the month, not just the data. */
  rangeFrom?: string
  rangeTo?: string
  activeDate?: string
  onJump: (date: string) => void
  /** Cumulative spend through the day currently in view. */
  cumulative: number
  monthTotal: number
  variant?: 'rail' | 'index'
}

const dayNumber = (iso: string) => String(fromIsoDay(iso).getDate())

/**
 * The month profile *is* the navigation. Bar length is that day's spending, so
 * scrolling position and the shape of the month are one control: reaching the
 * 1st is a click, never 180 rows of scrolling.
 *
 * Every day of the range gets a row, spent or not. Drawing only the days that
 * happen to carry expenses made a quiet month render as three marks stranded in
 * a tall empty column, and made the gaps — the days nobody spent anything —
 * invisible, when they are half of what a month's shape tells you.
 */
export const MonthRail = ({
  days,
  rangeFrom,
  rangeTo,
  activeDate,
  onJump,
  cumulative,
  monthTotal,
  variant = 'rail',
}: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const currency = useCurrency()

  const totalByDate = useMemo(
    () => new Map(days.map((day) => [day.date, day.total])),
    [days],
  )

  // The scaffold is the range, clipped at today: the current month's remaining
  // days have not happened, and drawing twenty-five of them as empty rows says
  // the household spent nothing on dates that have not arrived. It falls back
  // to the data whenever the range is missing or too wide to draw honestly.
  const scaffold = useMemo(() => {
    const today = isoDay(new Date())
    const end = rangeTo && rangeTo > today ? today : rangeTo
    const spanned =
      rangeFrom && end && end >= rangeFrom
        ? eachDayDescending(rangeFrom, end)
        : []
    return spanned.length > 0 ? spanned : days.map((day) => day.date)
  }, [rangeFrom, rangeTo, days])

  const peak = days.reduce((max, day) => Math.max(max, day.total), 0) || 1
  const pct = monthTotal > 0 ? Math.round((cumulative / monthTotal) * 100) : 0

  // Nothing to profile and nowhere to jump: an empty month drew thirty-one
  // blank ticks over a "through —", which is a control that cannot be used
  // taking up the width of one that can.
  if (days.length === 0) return null

  if (variant === 'index') {
    // Thumb-reachable edge index: every fourth day that has entries, plus the
    // active one. Empty days are not jump targets, so they are not listed.
    const marks = days.filter(
      (day, i) => i % 4 === 0 || day.date === activeDate,
    )
    return (
      <nav
        aria-label={m.rail_month()}
        className="bg-card/95 flex w-7 flex-col items-center gap-0.5 rounded-xl py-1.5 shadow-sm"
      >
        {marks.map((day) => {
          const isActive = day.date === activeDate
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onJump(day.date)}
              aria-label={m.rail_jump_to({
                date: new Intl.DateTimeFormat(locale, {
                  day: 'numeric',
                  month: 'short',
                }).format(fromIsoDay(day.date)),
              })}
              aria-current={isActive ? 'true' : undefined}
              className={
                isActive
                  ? 'text-accent ring-accent bg-card grid h-6 w-6 place-items-center rounded-md text-[8.5px] font-bold ring-2'
                  : 'text-muted grid h-6 w-6 place-items-center text-[8.5px] font-bold'
              }
            >
              {dayNumber(day.date)}
            </button>
          )
        })}
      </nav>
    )
  }

  return (
    // `self-start`, not `h-full`: the rail is as tall as the month it draws.
    // Stretching it to the column and spacing the rows apart to fill was what
    // made a short month read as a broken chart.
    <nav
      aria-label={m.rail_month()}
      className="well-shadow bg-chip hidden max-h-full w-[104px] shrink-0 flex-col self-start rounded-xl p-2.5 lg:flex"
    >
      <p className="text-muted shrink-0 text-center text-[8px] font-bold tracking-[0.1em] uppercase">
        {m.rail_month()}
      </p>

      <ol className="mt-2.5 flex min-h-0 flex-col gap-[3px] overflow-y-auto">
        {scaffold.map((date, index) => {
          const total = totalByDate.get(date) ?? 0
          const isActive = date === activeDate
          // A five-day month with one number on it is not a scale. Label every
          // day while they fit, and thin out to every fifth once they do not.
          const isLabelled =
            isActive || scaffold.length <= 10 || index % 5 === 0

          const label = (
            <span
              className={`w-[13px] shrink-0 text-right text-[7.5px] font-bold tabular-nums ${
                isActive
                  ? 'text-ink'
                  : isLabelled
                    ? 'text-muted'
                    : 'text-transparent'
              }`}
            >
              {dayNumber(date)}
            </span>
          )

          if (total === 0) {
            return (
              <li
                key={date}
                aria-hidden="true"
                className="flex items-center gap-1.5"
              >
                {label}
                <span className="bg-bar/30 h-px w-1 shrink-0 rounded-full" />
              </li>
            )
          }

          return (
            <li key={date} className="flex">
              <button
                type="button"
                onClick={() => onJump(date)}
                aria-current={isActive ? 'true' : undefined}
                aria-label={`${m.rail_jump_to({
                  date: new Intl.DateTimeFormat(locale, {
                    day: 'numeric',
                    month: 'long',
                  }).format(fromIsoDay(date)),
                })} — ${formatCurrency(total, currency, locale)}`}
                className="group flex w-full items-center gap-1.5 rounded-sm"
              >
                {label}
                {/* Bars run from a shared left baseline so the column of day
                    numbers stays a column; right-aligned bars moved every
                    number to a different x. */}
                <span
                  aria-hidden="true"
                  style={{ width: `${Math.max(7, (total / peak) * 100)}%` }}
                  className={`h-[3px] rounded-r-full ${
                    isActive ? 'bg-accent' : 'bg-bar group-hover:bg-ink/60'
                  }`}
                />
              </button>
            </li>
          )
        })}
      </ol>

      <div className="border-hair mt-3 shrink-0 border-t pt-2.5">
        <p className="text-muted text-[7.5px] leading-tight font-bold tracking-[0.07em] whitespace-nowrap uppercase">
          {m.rail_up_to({
            date: activeDate
              ? new Intl.DateTimeFormat(locale, {
                  day: 'numeric',
                  month: 'short',
                }).format(fromIsoDay(activeDate))
              : '—',
          })}
        </p>
        <p className="font-display tnum mt-1 text-[13.5px] leading-none font-bold">
          {formatCurrency(cumulative, currency, locale)}
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="bg-track h-[3px] flex-1 overflow-hidden rounded-full"
          >
            <span
              className="bg-accent block h-full rounded-full"
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className="text-muted tnum text-[8px] font-bold">{pct}%</span>
        </div>
      </div>
    </nav>
  )
}
