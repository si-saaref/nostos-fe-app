import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { MonthStepper } from '@/modules/financial/components/MonthStepper'
import { StripShell } from '@/modules/financial/components/StripShell'
import { incomeMonthFigures } from '@/modules/financial/lib/incomeFigures'
import { formatCurrency } from '@/utils/formatters'
import type { StripFigure } from '@/modules/financial/components/StripShell'
import type { CalendarMonth } from '@/modules/financial/lib/calendarMonth'
import type { Paginated, Totals } from '@/types/api'
import type { Income } from '@/types/income'

interface Props {
  month: Date
  onStepMonth: (delta: number) => void
  onSelectMonth: (month: Date) => void
  canStepForward: boolean
  expenseTotals?: Totals
  incomePage?: Paginated<Income>
  calendar: CalendarMonth
  /** No response yet. Cells print a dash, never `IDR 0`. */
  isLoading: boolean
}

/**
 * The month's four figures.
 *
 * `Moved` takes a cell of its own rather than a note under `In`. This page is
 * the only one showing both ledgers at once, which is exactly where a transfer
 * is most likely to be misread as income — so the distinction the income
 * surface is built around gets more room here, not less.
 *
 * There is no `Net` cell. A flow total sitting in the place a reader expects a
 * balance is the confusion `/income` spends its whole layout preventing, and
 * no cell here is worth reopening it.
 */
export const CalendarStrip = ({
  month,
  onStepMonth,
  onSelectMonth,
  canStepForward,
  expenseTotals,
  incomePage,
  calendar,
  isLoading,
}: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const currency = useCurrency()

  const money = (value: number) => formatCurrency(value, currency, locale)
  const figures = incomeMonthFigures(incomePage)

  const spent = expenseTotals?.sum ?? 0
  const spentCount = expenseTotals?.count ?? 0
  // Already net: `sum(to) − sum(from)`, so a transfer has cancelled itself out
  // and what is left came from outside the household.
  const received = incomePage?.totals?.sum ?? 0
  const activeDays = calendar.days.filter((day) => day.count > 0).length

  const stripFigures: StripFigure[] = [
    {
      id: 'out',
      isLoading,
      key: m.cal_out(),
      value: money(spent),
      note:
        spentCount === 1
          ? m.cal_out_note_one()
          : m.cal_out_note({ n: spentCount }),
      isNil: spent === 0,
    },
    {
      id: 'in',
      isLoading,
      key: m.cal_in(),
      value: money(received),
      note:
        figures.externalCount === null
          ? m.inc_in_note_unknown()
          : figures.externalCount === 1
            ? m.cal_in_note_one()
            : m.cal_in_note({ n: figures.externalCount }),
      isNil: received === 0,
    },
    {
      id: 'moved',
      isLoading,
      key: m.cal_moved(),
      value: figures.moved === null ? m.inc_unknown() : money(figures.moved),
      note:
        figures.transferCount === null
          ? m.inc_in_note_unknown()
          : figures.transferCount === 1
            ? m.cal_moved_note_one()
            : m.cal_moved_note({ n: figures.transferCount }),
      isNil: figures.moved === null || figures.moved === 0,
    },
    {
      id: 'entries',
      isLoading,
      key: m.cal_entries(),
      value: calendar.entryCount.toLocaleString(locale),
      note:
        activeDays === 0
          ? m.cal_entries_note_none()
          : activeDays === 1
            ? m.cal_entries_note_one()
            : m.cal_entries_note({ n: activeDays }),
      isNil: calendar.entryCount === 0,
    },
  ]

  return (
    <StripShell label={m.cal_strip_title()} figures={stripFigures}>
      <MonthStepper
        month={month}
        onStep={onStepMonth}
        onSelect={onSelectMonth}
        canStepForward={canStepForward}
      />
    </StripShell>
  )
}
