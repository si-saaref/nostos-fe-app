import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { useIncome } from '@/modules/financial/api/income'
import { MonthStepper } from '@/modules/financial/components/MonthStepper'
import { StripShell } from '@/modules/financial/components/StripShell'
import { formatCurrency } from '@/utils/formatters'
import { fromIsoDay } from '@/utils/dates'
import type { StripFigure } from '@/modules/financial/components/StripShell'
import type { IncomeMonthFigures } from '@/modules/financial/lib/incomeFigures'
import type { Summary, Totals } from '@/types/api'

interface Props {
  householdId: string
  /** First day of the month in view. */
  month: Date
  previousMonth: { from: string; to: string }
  onStepMonth: (delta: number) => void
  onSelectMonth: (month: Date) => void
  canStepForward: boolean
  /** Filter-scoped aggregates for the month in view. */
  totals?: Totals
  /**
   * The list response's summary block, when the deployment sends one. Its
   * `previous` is exactly what the extra request below buys.
   */
  summary?: Summary
  /** What the month opened at — a carried balance, not a flow. */
  opening?: number
  /** False while the position endpoint has not answered. */
  hasOpening: boolean
  figures: IncomeMonthFigures
}

const monthLabel = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    date,
  )

/**
 * The month's money, and the one figure on the strip that is not the month's.
 *
 * Cell one is a **stock**: what the household was holding when the month
 * opened, carried from every month before it. Cells two to four are **flows**,
 * scoped to the month in the stepper. Mixing the two silently is the failure
 * this strip is arranged to prevent, so cell one prints the month it came
 * from and the others print theirs.
 *
 * There is deliberately no separate "real income" cell. `totals.sum` is
 * `sum(to) − sum(from)`, so a transfer cancels itself and what survives *is*
 * money from outside the household — two cells would be one number twice.
 */
export const InflowStrip = ({
  householdId,
  month,
  previousMonth,
  onStepMonth,
  onSelectMonth,
  canStepForward,
  totals,
  summary,
  opening,
  hasOpening,
  figures,
}: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const currency = useCurrency()

  // A whole second request for one number, and only because the list route
  // could not answer "and what did last month close at?". It stands down the
  // moment a summary carries it.
  const hasServerPrevious = summary?.previous !== undefined
  const previousQuery = useIncome(
    householdId,
    {
      dateFrom: previousMonth.from,
      dateTo: previousMonth.to,
      page: 1,
      limit: 1,
    },
    { enabled: !hasServerPrevious },
  )
  const previousTotals = summary?.previous ?? previousQuery.data?.totals

  const sum = totals?.sum ?? 0
  const previousSum = previousTotals?.sum ?? 0
  const thisMonthLabel = monthLabel(month, locale)
  const previousLabel = monthLabel(fromIsoDay(previousMonth.from), locale)
  const money = (value: number) => formatCurrency(value, currency, locale)

  /**
   * The fresh-month rule.
   *
   * A month-over-month delta on the first of the month is arithmetically true
   * and practically a lie: every new month opens at −100%. So the comparison
   * only claims a percentage once there is something in this month to compare,
   * and otherwise states the figure the previous month actually closed at —
   * which is the useful fact on 1 October anyway.
   */
  const hasComparison = sum > 0 && previousSum > 0
  const deltaPct = hasComparison
    ? Math.round(((sum - previousSum) / previousSum) * 1000) / 10
    : null

  const countNote = (
    n: number | null,
    one: string,
    many: (args: { n: number }) => string,
  ) => (n === null ? m.inc_in_note_unknown() : n === 1 ? one : many({ n }))

  const stripFigures: StripFigure[] = [
    {
      id: 'opening',
      key: m.inc_opened_at({ month: thisMonthLabel }),
      // A dash rather than Rp 0: the position endpoint not having answered is
      // not the same claim as a household that opened the month with nothing.
      value: hasOpening ? money(opening ?? 0) : m.inc_unknown(),
      note: m.inc_carried_from({ month: previousLabel }),
      isNil: !hasOpening,
    },
    {
      id: 'in',
      key: m.inc_in(),
      value: money(sum),
      note: countNote(
        figures.externalCount,
        m.inc_in_note_one(),
        m.inc_in_note,
      ),
      isNil: sum === 0,
    },
    {
      id: 'moved',
      key: m.inc_moved(),
      value: figures.moved === null ? m.inc_unknown() : money(figures.moved),
      note: countNote(
        figures.transferCount,
        m.inc_moved_note_one(),
        m.inc_moved_note,
      ),
      isNil: figures.moved === null || figures.moved === 0,
    },
    {
      id: 'previous',
      key: m.inc_vs({ month: previousLabel }),
      // A zero change has no direction, and `▼ 0%` claimed one — the arrow
      // only appears when the figure actually moved.
      value:
        deltaPct === null
          ? m.inc_unknown()
          : deltaPct === 0
            ? m.inc_vs_flat()
            : `${deltaPct > 0 ? '▲' : '▼'} ${Math.abs(deltaPct).toLocaleString(locale)}%`,
      note:
        !previousTotals && previousQuery.isLoading
          ? undefined
          : hasComparison
            ? m.inc_vs_note({
                month: previousLabel,
                amount: money(previousSum),
              })
            : m.inc_vs_closed({
                month: previousLabel,
                amount: money(previousSum),
              }),
      tone: deltaPct !== null && deltaPct > 0 ? 'delta' : 'muted',
      isNil: deltaPct === null || deltaPct === 0,
    },
  ]

  return (
    <StripShell label={m.inc_strip_title()} figures={stripFigures}>
      <MonthStepper
        month={month}
        onStep={onStepMonth}
        onSelect={onSelectMonth}
        canStepForward={canStepForward}
      />
    </StripShell>
  )
}
