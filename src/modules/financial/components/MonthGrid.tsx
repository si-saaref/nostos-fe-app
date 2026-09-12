import { useCallback, useRef } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import {
  leadingBlanks,
  markFraction,
} from '@/modules/financial/lib/calendarMonth'
import { formatCurrency, formatDate } from '@/utils/formatters'
import type {
  CalendarDay,
  CalendarMonth,
} from '@/modules/financial/lib/calendarMonth'

interface Props {
  /** First day of the month in view. */
  month: Date
  calendar: CalendarMonth
  selectedDate: string | null
  /** Today as an ISO day, passed in so the grid stays pure at any clock. */
  today: string
  onSelect: (date: string) => void
}

/** Tallest a mark may draw, in px, at each breakpoint's cell height. */
const MARK_PX = 44
const MARK_PX_SM = 20

/**
 * The month, as seven columns.
 *
 * The cell carries no figures on purpose: thirty long rupiah amounts in a grid
 * is a table wearing a calendar's clothes, and the shape of the month — which
 * days were heavy, which were quiet, when money arrived — is exactly what the
 * two ledgers cannot show. Figures live one click away in the day sheet, and
 * in every cell's accessible name, so nothing is only available to the eye.
 *
 * Marks are drawn against the busiest day **of their own stream**. One shared
 * scale is arithmetically tidier and useless: a single salary is twenty times
 * any grocery run, so it draws at full height and flattens the whole month
 * beneath it. Day-to-day within a stream is the comparison a reader makes; the
 * strip above answers out-versus-in.
 */
export const MonthGrid = ({
  month,
  calendar,
  selectedDate,
  today,
  onSelect,
}: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const currency = useCurrency()
  const gridRef = useRef<HTMLDivElement>(null)

  const weekdays = weekdayNames(locale)
  const lead = leadingBlanks(month)
  const days = calendar.days

  /**
   * The one day in the tab order. Tab reaches the grid once and the arrows
   * walk it from there — thirty tab stops for one control is not navigation.
   */
  const tabStop =
    selectedDate ?? (days.some((day) => day.date === today) ? today : null)
  const tabStopDate = tabStop ?? days[0]?.date

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[
      event.key
    ]
    if (!step || !gridRef.current) return
    event.preventDefault()
    const cells = [
      ...gridRef.current.querySelectorAll<HTMLButtonElement>(
        'button[data-day]',
      ),
    ]
    const from = cells.indexOf(document.activeElement as HTMLButtonElement)
    // Stopping at the edges rather than wrapping: the month is the scope, and
    // arrowing off the 1st into the 30th is a jump nobody asked for.
    cells[from + step]?.focus()
  }, [])

  const money = (value: number) => formatCurrency(value, currency, locale)

  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1.5" aria-hidden="true">
        {weekdays.map((name, index) => (
          <span
            key={index}
            className="text-muted text-center text-[9.5px] font-bold tracking-[0.1em] uppercase"
          >
            {name}
          </span>
        ))}
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={m.cal_grid_label({ month: monthLabel(month, locale) })}
        onKeyDown={onKeyDown}
        className="flex flex-col gap-1.5"
      >
        {/* Real rows, not one flat grid: `role="grid"` owns rows, and a
            screen reader announcing "week 3, Thursday" is the whole reason to
            use the role rather than a list. */}
        {weeksOf(days, lead).map((week, index) => (
          <div key={index} role="row" className="grid grid-cols-7 gap-1.5">
            {week.map((day, column) =>
              day === null ? (
                <div key={`blank-${column}`} role="presentation" />
              ) : (
                <DayCell
                  key={day.date}
                  day={day}
                  calendar={calendar}
                  isToday={day.date === today}
                  isFuture={day.date > today}
                  isSelected={day.date === selectedDate}
                  isTabStop={day.date === tabStopDate}
                  label={accessibleName(day, {
                    date: formatDate(day.date, locale),
                    isFuture: day.date > today,
                    money,
                    m,
                  })}
                  onSelect={onSelect}
                />
              ),
            )}
          </div>
        ))}
      </div>

      <div className="border-hair text-muted mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t pt-2.5 text-[10.5px]">
        <span className="flex items-center gap-1.5 font-medium">
          <i className="bg-ink block h-3 w-2 rounded-[2px]" />
          {m.cal_legend_out()}
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <i className="bg-rim-1 block h-3 w-2 rounded-[2px]" />
          {m.cal_legend_in()}
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <i className="bg-bar block h-1.5 w-2 rounded-[2px]" />
          {m.cal_legend_moved()}
        </span>
        <span className="ml-auto hidden font-medium opacity-85 sm:block">
          {m.cal_legend_scale()}
        </span>
      </div>
    </div>
  )
}

interface CellProps {
  day: CalendarDay
  calendar: CalendarMonth
  isToday: boolean
  isFuture: boolean
  isSelected: boolean
  isTabStop: boolean
  label: string
  onSelect: (date: string) => void
}

const DayCell = ({
  day,
  calendar,
  isToday,
  isFuture,
  isSelected,
  isTabStop,
  label,
  onSelect,
}: CellProps) => {
  const dayNumber = Number(day.date.slice(8))

  return (
    <button
      type="button"
      role="gridcell"
      data-day={day.date}
      data-today={isToday || undefined}
      aria-selected={isSelected}
      aria-label={label}
      tabIndex={isTabStop ? 0 : -1}
      onClick={() => onSelect(day.date)}
      className={`relative flex min-h-[44px] flex-col rounded-lg px-1.5 py-1.5 text-left transition-[background-color,box-shadow] duration-150 ease-out sm:min-h-[92px] sm:rounded-xl sm:px-2 sm:py-1.5 ${
        isFuture
          ? 'shadow-[inset_0_0_0_1px_var(--hair)]'
          : isSelected
            ? 'bg-card shadow-[0_0_0_1.5px_var(--ink),0_2px_2px_rgb(var(--shadow-rgb)/0.06),0_14px_26px_-14px_rgb(var(--shadow-rgb)/0.4)]'
            : 'bg-chip hover:bg-card hover:shadow-[0_1px_0_rgb(var(--shadow-rgb)/0.05),0_5px_12px_-9px_rgb(var(--shadow-rgb)/0.28)]'
      }`}
    >
      <span
        className={`font-display text-[11px] leading-none font-bold sm:text-[13px] ${
          isToday
            ? 'bg-accent text-accent-ink -mx-0.5 -mt-0.5 grid h-[17px] w-[17px] place-items-center rounded-full sm:h-[19px] sm:w-[19px]'
            : isFuture
              ? 'text-muted opacity-60'
              : 'text-ink'
        }`}
      >
        {dayNumber}
      </span>

      {!isFuture && day.count > 0 && (
        <span
          aria-hidden="true"
          className="mt-auto flex h-5 items-end gap-[3px] sm:h-11 sm:gap-1"
        >
          <Mark
            value={day.spent}
            max={calendar.maxSpent}
            className="bg-ink w-[7px] sm:w-[9px]"
          />
          <Mark
            value={day.inflow}
            max={calendar.maxInflow}
            className="bg-rim-1 w-[7px] sm:w-[9px]"
          />
          {day.moved > 0 && (
            <Mark
              value={day.moved}
              max={calendar.maxMoved}
              // Short and muted, and capped well below the other two: a
              // transfer is real movement but it changed nothing, and a bar
              // as tall as a salary's would say otherwise.
              cap={0.45}
              className="bg-bar w-[5px] sm:w-[6px]"
            />
          )}
        </span>
      )}
    </button>
  )
}

/**
 * `--track` rather than nothing for a stream with no entry that day: the two
 * marks keep their positions, so the eye reads down a column instead of
 * re-finding which bar is which on every cell.
 */
const Mark = ({
  value,
  max,
  cap = 1,
  className,
}: {
  value: number
  max: number
  cap?: number
  className: string
}) => {
  const fraction = markFraction(value, max) * cap
  if (fraction === 0) {
    return <i className={`bg-track block h-[2px] rounded-[1px] ${className}`} />
  }
  return (
    <i
      // Two heights, because the cell has two: the tall grid only exists from
      // `sm` up, and a bar sized for it overflows the phone cell.
      className={`block h-[var(--mark-sm)] rounded-t-[2px] rounded-b-[1px] sm:h-[var(--mark-lg)] ${className}`}
      style={
        {
          '--mark-sm': `${Math.round(fraction * MARK_PX_SM)}px`,
          '--mark-lg': `${Math.round(fraction * MARK_PX)}px`,
        } as CSSProperties
      }
    />
  )
}

/** The month in weeks of seven, padded to the Monday-start offset. */
const weeksOf = (
  days: CalendarDay[],
  lead: number,
): (CalendarDay | null)[][] => {
  const cells: (CalendarDay | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...days,
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, week) =>
    cells.slice(week * 7, week * 7 + 7),
  )
}

const monthLabel = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    date,
  )

/** Weekday initials in the reader's own language, Monday first. */
const weekdayNames = (locale: string) => {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  // 2026-06-01 is a Monday.
  return Array.from({ length: 7 }, (_, index) =>
    format.format(new Date(2026, 5, 1 + index)),
  )
}

/**
 * The whole day, spelled out. This is the only place a figure on this grid is
 * available to a screen reader, so it states every stream the day holds and
 * keeps arrival and movement apart exactly as the marks do.
 */
const accessibleName = (
  day: CalendarDay,
  {
    date,
    isFuture,
    money,
    m,
  }: {
    date: string
    isFuture: boolean
    money: (value: number) => string
    m: ReturnType<typeof useMessages>
  },
): string => {
  if (isFuture) return m.cal_day_future({ date })
  if (day.count === 0) return m.cal_day_quiet({ date })

  const facts: string[] = []
  if (day.spent > 0) facts.push(m.cal_a11y_spent({ amount: money(day.spent) }))
  if (day.inflow > 0)
    facts.push(m.cal_a11y_received({ amount: money(day.inflow) }))
  if (day.moved > 0) facts.push(m.cal_a11y_moved({ amount: money(day.moved) }))
  return m.cal_day_reads({ date, facts: facts.join(', ') })
}
