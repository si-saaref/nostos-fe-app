import { useMessages } from '@/i18n/useMessages'
import { useBalanceFigure } from '@/modules/financial/hooks/useBalanceFigure'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/utils/formatters'
import { fromIsoDay, previousMonthRange } from '@/utils/dates'
import { MonthStepper } from '@/modules/financial/components/MonthStepper'
import { StripShell } from '@/modules/financial/components/StripShell'
import { RIM_CLASS } from '@/theme/rims'
import type { StripFigure } from '@/modules/financial/components/StripShell'
import type { ScopeChip, TopSlice } from '@/modules/financial/types/ledger'
import type { Summary, Totals } from '@/types/api'
import type { ExpenseFilters } from '@/types/expense'

interface Props {
  householdId: string
  filters: ExpenseFilters
  totals?: Totals
  /**
   * The list response's summary block, when the deployment sends one. Its
   * `previous` is the same figure the extra request below buys, so having it
   * is what lets that request stand down.
   */
  summary?: Summary
  /**
   * Has the list query answered yet? Without it the fallback below fires on
   * the first render of every page load — the summary cannot be inspected
   * before the response carrying it arrives, so "no summary" and "not yet"
   * look identical, and the request this is meant to retire goes out anyway.
   */
  listLoaded: boolean
  /** First day of the month in view. */
  month: Date
  onStepMonth: (delta: number) => void
  /** Jump straight to a month, from the picker behind the label. */
  onSelectMonth: (month: Date) => void
  canStepForward: boolean
  /** Active narrowings, dismissible here because this is where they are stated. */
  scopes: ScopeChip[]
  onRemoveScope: (id: ScopeChip['id']) => void
  /** Largest contributor to the filtered spend; null while it cannot be trusted. */
  slice: TopSlice | null
}

const monthLabel = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    date,
  )

/**
 * The count, announced in front of everyone — and it always prints the scope
 * it is counting. `totals` follows the filters, so a figure without its range
 * and filters attached is a confident lie the moment anything is narrowed.
 *
 * The scope is also the control: the month steps from the label that states it,
 * and each narrowing is removed from the chip that declares it.
 */
export const CountStrip = ({
  householdId,
  totals,
  summary,
  listLoaded,
  month,
  onStepMonth,
  onSelectMonth,
  canStepForward,
  scopes,
  onRemoveScope,
  slice,
}: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const currency = useCurrency()
  const previous = previousMonthRange(month)

  const balance = useBalanceFigure(householdId)
  const isLoading = !listLoaded
  const sum = totals?.sum ?? 0
  const count = totals?.count ?? 0
  const comparison = summary?.comparison
  const deltaPct =
    comparison?.percentage == null ? null : Number(comparison.percentage)
  const movement =
    deltaPct === null
      ? m.comparison_unavailable()
      : `${deltaPct > 0 ? '▲ +' : deltaPct < 0 ? '▼ −' : ''}${Math.abs(deltaPct).toLocaleString(locale)}%`

  const figures: StripFigure[] = [
    balance,
    {
      id: 'total',
      isLoading,
      key: m.count_total(),
      value: totals
        ? formatCurrency(totals.sumText ?? sum, currency, locale)
        : '—',
      note: m.count_vs_previous({
        pct: movement,
        month: monthLabel(fromIsoDay(previous.from), locale),
      }),
      tone:
        deltaPct === null || deltaPct === 0
          ? 'muted'
          : deltaPct > 0
            ? 'unfavorable'
            : 'favorable',
    },
    {
      id: 'entries',
      isLoading,
      key: m.count_transactions(),
      value: totals ? String(count) : '—',
      note: totals ? m.count_expenses({ n: count }) : undefined,
    },
    {
      id: 'slice',
      isLoading,
      key: slice?.kind === 'member' ? m.count_who() : m.count_where(),
      value: slice ? slice.name : '—',
      note: slice
        ? m.count_slice({
            amount: formatCurrency(
              slice.amountText ?? slice.amount,
              currency,
              locale,
            ),
            pct: `${slice.pct}%`,
          })
        : count > 0
          ? m.count_slice_partial()
          : null,
      tone: 'muted',
      sub: slice?.runnerUp
        ? m.count_runner_up({
            name: slice.runnerUp.name,
            pct: `${slice.runnerUp.pct}%`,
          })
        : undefined,
      // A name, not a figure: it has to survive "Kebutuhan rumah tangga".
      isText: true,
    },
  ]

  return (
    <StripShell label={m.count_title()} figures={figures}>
      <MonthStepper
        month={month}
        onStep={onStepMonth}
        onSelect={onSelectMonth}
        canStepForward={canStepForward}
      />

      {scopes.map((scope) => (
        <span
          key={scope.id}
          className="text-on-strip flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 py-0.5 pr-1 pl-2.5 text-[10.5px] font-semibold"
        >
          {scope.rim && (
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${RIM_CLASS[scope.rim]}`}
            />
          )}
          {scope.label}
          <button
            type="button"
            onClick={() => onRemoveScope(scope.id)}
            aria-label={m.count_filter_remove({ what: scope.label })}
            className="text-on-strip-muted hover:text-on-strip relative grid h-4 w-4 place-items-center rounded-full before:absolute before:-inset-2 before:content-[''] hover:bg-white/20"
          >
            <svg width="7" height="7" viewBox="0 0 7 7" aria-hidden="true">
              <path
                d="M1 1l5 5M6 1L1 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </span>
      ))}
    </StripShell>
  )
}
