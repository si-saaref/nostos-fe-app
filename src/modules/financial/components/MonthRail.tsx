import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/utils/formatters'
import { fromIsoDay } from '@/utils/dates'
import type { DayTotal } from '@/modules/financial/types/ledger'

interface Props {
  /** Newest first, matching the tape. */
  days: DayTotal[]
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
 */
export const MonthRail = ({
  days,
  activeDate,
  onJump,
  cumulative,
  monthTotal,
  variant = 'rail',
}: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const currency = useCurrency()
  const peak = days.reduce((max, day) => Math.max(max, day.total), 0) || 1
  const pct = monthTotal > 0 ? Math.round((cumulative / monthTotal) * 100) : 0

  if (variant === 'index') {
    // Thumb-reachable edge index: every fourth day, plus the active one.
    const marks = days.filter(
      (day, i) => i % 4 === 0 || day.date === activeDate,
    )
    return (
      <nav
        aria-label={m.rail_month()}
        className="bg-card/95 flex w-6 flex-col items-center justify-between rounded-xl py-1.5 shadow-sm"
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
                  ? 'text-accent ring-accent bg-card grid h-6 w-5 place-items-center rounded-md text-[8px] font-bold ring-2'
                  : 'text-muted grid h-4 w-5 place-items-center text-[8px] font-bold'
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
    <nav
      aria-label={m.rail_month()}
      className="well-shadow bg-chip hidden h-full w-[92px] shrink-0 flex-col rounded-xl p-2.5 lg:flex"
    >
      <p className="text-muted shrink-0 text-center text-[8px] font-bold tracking-[0.1em] uppercase">
        {m.rail_month()}
      </p>

      <ol className="relative mt-2.5 flex min-h-0 flex-1 flex-col justify-between gap-[2px] overflow-hidden">
        {days.map((day, index) => {
          const isActive = day.date === activeDate
          const isLabelled = isActive || index % 5 === 0
          const width = Math.max(6, Math.round((day.total / peak) * 100))
          return (
            <li key={day.date} className="flex justify-end">
              <button
                type="button"
                onClick={() => onJump(day.date)}
                aria-current={isActive ? 'true' : undefined}
                aria-label={`${m.rail_jump_to({
                  date: new Intl.DateTimeFormat(locale, {
                    day: 'numeric',
                    month: 'long',
                  }).format(fromIsoDay(day.date)),
                })} — ${formatCurrency(day.total, currency, locale)}`}
                className="group flex w-full items-center justify-end gap-1.5 rounded-sm py-[1px]"
              >
                <span
                  className={`text-[7.5px] font-bold ${
                    isActive
                      ? 'text-ink'
                      : isLabelled
                        ? 'text-muted'
                        : 'text-muted opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {dayNumber(day.date)}
                </span>
                <span
                  aria-hidden="true"
                  style={{ width: `${width}%` }}
                  className={`h-1 rounded-l-sm ${
                    isActive ? 'bg-accent' : 'bg-bar group-hover:bg-ink/50'
                  }`}
                />
              </button>
            </li>
          )
        })}
      </ol>

      <div className="border-hair mt-3 shrink-0 border-t pt-2 text-center">
        <p className="text-muted text-[7.5px] font-bold tracking-[0.09em] uppercase">
          {m.rail_up_to({
            date: activeDate
              ? new Intl.DateTimeFormat(locale, {
                  day: 'numeric',
                  month: 'short',
                }).format(fromIsoDay(activeDate))
              : '—',
          })}
        </p>
        <p className="font-display tnum mt-0.5 text-[13px] font-bold">
          {formatCurrency(cumulative, currency, locale)}
        </p>
        <p className="text-muted mt-0.5 text-[8.5px]">{pct}%</p>
      </div>
    </nav>
  )
}
