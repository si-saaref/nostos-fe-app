import { useMemo, useState } from 'react'
import { Popover } from 'radix-ui'
import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { FormField } from '@/components/FormField'
import { fromIsoDay, isoDay, shiftDays } from '@/utils/dates'

interface Props {
  label: string
  /** `YYYY-MM-DD`, or '' for unset. */
  value: string
  onChange: (value: string) => void
  /** Latest selectable day, `YYYY-MM-DD`. Days after it are unreachable. */
  max?: string
  error?: string
  className?: string
  disabled?: boolean
}

/** Monday-first weeks: the calendar an Indonesian household reads. */
const WEEK_START = 1
const CELLS = 42

/** Every cell of the six-week grid the month sits in, Monday-first. */
const gridFor = (month: Date): Date[] => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const lead = (first.getDay() - WEEK_START + 7) % 7
  const start = shiftDays(first, -lead)
  return Array.from({ length: CELLS }, (_, index) => shiftDays(start, index))
}

/**
 * A day, in the app's own hand.
 *
 * `<input type="date">` renders the OS calendar — a blue-and-grey panel with
 * system type and its own idea of a week — which is the one control in the
 * product that drops out of the theme entirely, and it is the control the
 * ledger uses most. So the trigger reads the date back in the household's
 * locale and the grid is ours: same plate, same rims, same tokens, Monday
 * first, with today marked and the future closed off where the caller says so.
 */
export const DateField = ({
  label,
  value,
  onChange,
  max,
  error,
  className = '',
  disabled = false,
}: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const [open, setOpen] = useState(false)

  const selected = value ? fromIsoDay(value) : null
  // The month being browsed. Reset on open so paging away and closing without
  // choosing cannot leave the panel somewhere the value never was.
  const [month, setMonth] = useState(() => selected ?? new Date())
  const setOpenState = (next: boolean) => {
    if (next) setMonth(selected ?? new Date())
    setOpen(next)
  }

  const today = isoDay(new Date())
  const days = useMemo(() => gridFor(month), [month])
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(month)
  const weekdays = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
    // 2024-01-01 was a Monday, so this walks the week from WEEK_START.
    return Array.from({ length: 7 }, (_, index) =>
      format.format(new Date(2024, 0, 1 + index)),
    )
  }, [locale])

  const step = (delta: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))
  const monthAfterMax =
    max !== undefined &&
    new Date(month.getFullYear(), month.getMonth(), 1) >=
      new Date(fromIsoDay(max).getFullYear(), fromIsoDay(max).getMonth(), 1)

  return (
    <FormField label={label} error={error} className={className}>
      <Popover.Root open={open} onOpenChange={setOpenState}>
        <Popover.Trigger
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          className={`well-shadow bg-chip ring-accent/45 group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] outline-none disabled:opacity-60 data-[state=open]:ring-1 ${
            error ? 'ring-danger ring-2' : ''
          }`}
        >
          <span className={value ? 'font-medium' : 'text-muted'}>
            {value
              ? new Intl.DateTimeFormat(locale, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }).format(fromIsoDay(value))
              : m.date_choose()}
          </span>
          <CalendarGlyph />
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            sideOffset={6}
            collisionPadding={12}
            aria-label={label}
            className="bg-card lift-shadow z-50 w-[258px] rounded-xl p-2.5 outline-none"
          >
            <div className="mb-2 flex items-center justify-between">
              <Step onClick={() => step(-1)} label={m.date_prev_month()} back />
              <span
                aria-live="polite"
                className="font-display text-[12px] font-bold"
              >
                {monthLabel}
              </span>
              <Step
                onClick={() => step(1)}
                label={m.date_next_month()}
                disabled={monthAfterMax}
              />
            </div>

            <div className="text-muted mb-1 grid grid-cols-7 text-center text-[9px] font-bold tracking-[0.08em] uppercase">
              {weekdays.map((day, index) => (
                <span key={index}>{day}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {days.map((day) => {
                const iso = isoDay(day)
                const outside = day.getMonth() !== month.getMonth()
                const isSelected = iso === value
                const isToday = iso === today
                const blocked = max !== undefined && iso > max
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={blocked}
                    aria-current={isToday ? 'date' : undefined}
                    onClick={() => {
                      onChange(iso)
                      setOpen(false)
                    }}
                    className={`tnum relative h-7 rounded-md text-[11.5px] font-medium disabled:opacity-30 ${
                      isSelected
                        ? 'bg-accent text-accent-ink font-bold'
                        : outside
                          ? 'text-muted/50 hover:bg-chip'
                          : 'hover:bg-chip'
                    }`}
                  >
                    {day.getDate()}
                    {/* Today is a mark, never the fill: the fill means
                        "chosen", and two states sharing one channel is how a
                        picker convinces you that you already picked. */}
                    {isToday && !isSelected && (
                      <span
                        aria-hidden="true"
                        className="bg-accent absolute inset-x-0 bottom-1 mx-auto h-[3px] w-[3px] rounded-full"
                      />
                    )}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                onChange(today)
                setOpen(false)
              }}
              className="text-accent mt-2 w-full rounded-md py-1 text-[11px] font-semibold"
            >
              {m.date_today()}
            </button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </FormField>
  )
}

const CalendarGlyph = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="text-muted ml-auto shrink-0"
  >
    <path d="M7 3v3m10-3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v13H4V7a1 1 0 0 1 1-1z" />
  </svg>
)

const Step = ({
  onClick,
  label,
  back = false,
  disabled = false,
}: {
  onClick: () => void
  label: string
  back?: boolean
  disabled?: boolean
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className="text-muted hover:bg-chip hover:text-ink grid h-6 w-6 place-items-center rounded-md disabled:opacity-30"
  >
    <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
      <path
        d={back ? 'M6.5 1.5L2.5 5l4 3.5' : 'M3.5 1.5L7.5 5l-4 3.5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
)
