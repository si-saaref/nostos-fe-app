import { useState } from 'react'
import { Popover } from 'radix-ui'
import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'

interface Props {
  /** First day of the month currently in scope. */
  month: Date
  onSelect: (month: Date) => void
}

const MONTH_COUNT = 12

/**
 * The month in scope, opened out into a year of months.
 *
 * The arrows either side of it answer "last month"; this answers "March".
 * Nine clicks back through a stepper is not navigation, it is attrition — but
 * the grid stays behind the label rather than replacing the arrows, because
 * stepping one month is what most of a review session actually does.
 *
 * Nothing after the month containing today is offerable: the ledger records
 * what has been paid, and an empty November is a view with no way to tell
 * "nothing spent" from "not yet".
 */
export const MonthPicker = ({ month, onSelect }: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const [open, setOpen] = useState(false)

  const today = new Date()
  const thisYear = today.getFullYear()
  const thisMonth = today.getMonth()

  // The year being browsed, which is not the year in scope until something is
  // chosen — paging to 2025 and closing must not re-scope the ledger, and
  // reopening must not resume where that abandoned paging left off.
  const [year, setYear] = useState(month.getFullYear())
  const setOpenState = (next: boolean) => {
    if (next) setYear(month.getFullYear())
    setOpen(next)
  }

  const monthName = (index: number) =>
    new Intl.DateTimeFormat(locale, { month: 'short' }).format(
      new Date(year, index, 1),
    )

  const label = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(month)

  const atLatestYear = year >= thisYear

  return (
    <Popover.Root open={open} onOpenChange={setOpenState}>
      <Popover.Trigger
        aria-label={`${label} — ${m.count_month_pick()}`}
        className="text-on-strip group flex min-w-[112px] items-center justify-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold hover:bg-white/15 data-[state=open]:bg-white/15"
      >
        {/* Announced here rather than on a wrapper: stepping the month
            re-scopes every figure on the strip and every row below it. */}
        <span aria-live="polite">{label}</span>
        <svg
          width="8"
          height="8"
          viewBox="0 0 10 10"
          aria-hidden="true"
          className="opacity-70 transition-transform duration-150 group-data-[state=open]:rotate-180"
        >
          <path
            d="M2 4l3 3 3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          collisionPadding={12}
          aria-label={m.count_month_pick()}
          className="bg-card lift-shadow z-50 w-[236px] rounded-xl p-2.5 outline-none"
        >
          <div className="mb-2 flex items-center justify-between">
            <YearStep
              label={m.count_year_prev()}
              direction="prev"
              onClick={() => setYear((current) => current - 1)}
            />
            <span className="font-display tnum text-[12.5px] font-bold tracking-[0.06em]">
              {year}
            </span>
            <YearStep
              label={m.count_year_next()}
              direction="next"
              disabled={atLatestYear}
              disabledHint={m.count_year_latest()}
              onClick={() => setYear((current) => current + 1)}
            />
          </div>

          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: MONTH_COUNT }, (_, index) => {
              const isFuture =
                year > thisYear || (year === thisYear && index > thisMonth)
              const isCurrent =
                year === month.getFullYear() && index === month.getMonth()
              return (
                <button
                  key={index}
                  type="button"
                  disabled={isFuture}
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => {
                    onSelect(new Date(year, index, 1))
                    setOpen(false)
                  }}
                  className={`rounded-lg py-[7px] text-center text-[11px] font-semibold disabled:pointer-events-none disabled:opacity-35 ${
                    isCurrent
                      ? 'bg-accent text-accent-ink'
                      : 'text-ink hover:bg-chip'
                  }`}
                >
                  {monthName(index)}
                </button>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

const YearStep = ({
  label,
  direction,
  onClick,
  disabled = false,
  disabledHint,
}: {
  label: string
  direction: 'prev' | 'next'
  onClick: () => void
  disabled?: boolean
  disabledHint?: string
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={disabled && disabledHint ? disabledHint : label}
    className="text-muted hover:text-ink hover:bg-chip grid h-6 w-6 place-items-center rounded-md disabled:pointer-events-none disabled:opacity-35"
  >
    <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
      <path
        d={direction === 'prev' ? 'M6 1L2.5 4.5 6 8' : 'M3 1l3.5 3.5L3 8'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
)
