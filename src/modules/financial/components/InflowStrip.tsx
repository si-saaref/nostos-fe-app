import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { useBalanceFigure } from '@/modules/financial/hooks/useBalanceFigure'
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
  /**
   * Has the list query answered yet? Without it the fallback below fires on
   * the first render of every page load — the summary cannot be inspected
   * before the response carrying it arrives, so "no summary" and "not yet"
   * look identical, and the request this is meant to retire goes out anyway.
   */
  listLoaded: boolean
  /** What the month opened at — a carried balance, not a flow. */
  opening?: number
  openingText?: string
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
  listLoaded,
  figures,
}: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const currency = useCurrency()

  const balance = useBalanceFigure(householdId)
  const isLoading = !listLoaded
  const sum = totals?.sum ?? 0
  const previousTotals = summary?.previous
  const previousLabel = monthLabel(fromIsoDay(previousMonth.from), locale)
  const money = (value: number | string) =>
    formatCurrency(value, currency, locale)
  const deltaPct =
    summary?.comparison?.percentage == null
      ? null
      : Number(summary.comparison.percentage)
  const countNote = (
    n: number | null,
    one: string,
    many: (args: { n: number }) => string,
  ) => (n === null ? m.inc_in_note_unknown() : n === 1 ? one : many({ n }))

  const stripFigures: StripFigure[] = [
    balance,
    {
      id: 'in',
      isLoading,
      key: m.inc_in(),
      value: totals ? money(totals.sumText ?? sum) : '—',
      note: countNote(
        figures.externalCount,
        m.inc_in_note_one(),
        m.inc_in_note,
      ),
      isNil: sum === 0,
    },
    {
      id: 'moved',
      isLoading,
      key: m.inc_moved(),
      value:
        figures.moved === null
          ? m.inc_unknown()
          : money(figures.movedText ?? figures.moved),
      note: countNote(
        figures.transferCount,
        m.inc_moved_note_one(),
        m.inc_moved_note,
      ),
      sub:
        summary?.current.cash_withdrawn === undefined
          ? m.cash_withdrawal_unavailable()
          : m.cash_withdrawal({
              amount: money(
                summary.current.cashWithdrawnText ??
                  summary.current.cash_withdrawn,
              ),
            }),
      isNil: figures.moved === null || figures.moved === 0,
    },
    {
      id: 'previous',
      isLoading,
      key: m.inc_vs({ month: previousLabel }),
      value:
        deltaPct === null
          ? m.inc_unknown()
          : `${deltaPct > 0 ? '▲ +' : deltaPct < 0 ? '▼ −' : ''}${Math.abs(deltaPct).toLocaleString(locale)}%`,
      note:
        deltaPct === null
          ? m.comparison_unavailable()
          : m.inc_vs_note({
              month: previousLabel,
              amount: money(
                previousTotals?.sumText ?? previousTotals?.sum ?? 0,
              ),
            }),
      tone:
        deltaPct === null || deltaPct === 0
          ? 'muted'
          : deltaPct > 0
            ? 'favorable'
            : 'unfavorable',
      isNil: deltaPct === null,
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
