import { useMessages } from '@/i18n/useMessages'
import { MonthPicker } from '@/modules/financial/components/MonthPicker'

interface Props {
  /** First day of the month in scope. */
  month: Date
  onStep: (delta: number) => void
  onSelect: (month: Date) => void
  canStepForward: boolean
}

/**
 * Last month, this month, or pick one — the same control on every ledger.
 *
 * Extracted rather than copied: it was private to the expenses count strip,
 * and a second hand-rolled copy on the income strip is how two pages end up
 * disagreeing about whether the forward arrow is disabled or absent.
 */
export const MonthStepper = ({
  month,
  onStep,
  onSelect,
  canStepForward,
}: Props) => {
  const m = useMessages()
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-white/15 bg-white/10 p-0.5">
      <Step
        label={m.count_month_prev()}
        onClick={() => onStep(-1)}
        direction="prev"
      />
      <MonthPicker month={month} onSelect={onSelect} />
      <Step
        label={m.count_month_next()}
        onClick={() => onStep(1)}
        direction="next"
        disabled={!canStepForward}
        disabledHint={m.count_month_latest()}
      />
    </div>
  )
}

const Step = ({
  label,
  onClick,
  direction,
  disabled = false,
  disabledHint,
}: {
  label: string
  onClick: () => void
  direction: 'prev' | 'next'
  disabled?: boolean
  disabledHint?: string
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    // Disabled forward still names *why*: "already the latest month" is a
    // different fact from "next month", and a dimmed arrow with the same label
    // reads as a broken control.
    aria-label={disabled && disabledHint ? disabledHint : label}
    className="text-on-strip grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-white/20 disabled:pointer-events-none disabled:opacity-35 sm:h-[22px] sm:w-[22px]"
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
