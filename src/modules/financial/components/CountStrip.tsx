import { useMessages } from '@/i18n/useMessages'
import { useExpenses } from '@/modules/financial/api/expenses'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/utils/formatters'
import { fromIsoDay, isoDay, previousMonthRange } from '@/utils/dates'
import { MonthPicker } from '@/modules/financial/components/MonthPicker'
import { RIM_CLASS } from '@/theme/rims'
import type { ScopeChip, TopSlice } from '@/modules/financial/types/ledger'
import type { Totals } from '@/types/api'
import type { ExpenseFilters } from '@/types/expense'

interface Props {
  householdId: string
  filters: ExpenseFilters
  totals?: Totals
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
  filters,
  totals,
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

  const previousQuery = useExpenses(householdId, {
    ...filters,
    dateFrom: previous.from,
    dateTo: previous.to,
    page: 1,
    limit: 1,
  })
  const previousTotals = previousQuery.data?.totals

  const sum = totals?.sum ?? 0
  const count = totals?.count ?? 0
  const average = totals?.average ?? 0
  const previousSum = previousTotals?.sum ?? 0
  const deltaPct =
    previousSum > 0
      ? Math.round(((sum - previousSum) / previousSum) * 1000) / 10
      : null

  // Elapsed days, not calendar days: five days into September, dividing by
  // thirty reports a household spending a third of what it actually is.
  const today = isoDay(new Date())
  const from = filters.dateFrom ?? today
  const to = (filters.dateTo ?? today) > today ? today : (filters.dateTo ?? '')
  const days = Math.max(
    1,
    Math.round(
      (fromIsoDay(to).getTime() - fromIsoDay(from).getTime()) / 86_400_000,
    ) + 1,
  )
  const perDay = Math.round((count / days) * 10) / 10

  const figures = [
    {
      id: 'total',
      key: m.count_total(),
      value: formatCurrency(sum, currency, locale),
      note:
        deltaPct === null
          ? null
          : m.count_vs_previous({
              pct: `${deltaPct > 0 ? '▲' : '▼'} ${Math.abs(deltaPct).toLocaleString(locale)}%`,
              month: monthLabel(fromIsoDay(previous.from), locale),
            }),
      tone: deltaPct !== null && deltaPct > 0 ? 'delta' : 'muted',
    },
    {
      id: 'previous',
      key: m.count_previous(),
      value: previousQuery.isLoading
        ? '—'
        : formatCurrency(previousSum, currency, locale),
      note: previousTotals
        ? previousTotals.count === 1
          ? m.tape_entries_one()
          : m.tape_entries_short({ n: previousTotals.count })
        : null,
      tone: 'muted',
    },
    {
      id: 'entries',
      key: m.count_entries(),
      value: String(count),
      // Rounded: an average is a summary figure, and printing it to the cent
      // ("avg IDR 73,842.11") claims a precision the number does not have.
      note: m.count_avg({
        amount: formatCurrency(Math.round(average), currency, locale),
      }),
      tone: 'muted',
      sub: m.count_per_day({ n: perDay.toLocaleString(locale) }),
    },
    {
      id: 'slice',
      key: slice?.kind === 'member' ? m.count_who() : m.count_where(),
      value: slice ? slice.name : '—',
      note: slice
        ? m.count_slice({
            amount: formatCurrency(slice.amount, currency, locale),
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
    <section
      aria-label={m.count_title()}
      className="strip-shadow rounded-2xl p-4 sm:p-5"
      style={{
        background:
          'linear-gradient(178deg, var(--strip-from), var(--strip-to))',
      }}
    >
      <div className="mb-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <h2 className="font-display text-strip-key text-[10px] font-bold tracking-[0.15em] uppercase">
          {m.count_title()}
        </h2>

        <div className="flex items-center gap-0.5 rounded-full border border-white/15 bg-white/10 p-0.5">
          <Step
            label={m.count_month_prev()}
            onClick={() => onStepMonth(-1)}
            direction="prev"
          />
          <MonthPicker month={month} onSelect={onSelectMonth} />
          <Step
            label={m.count_month_next()}
            onClick={() => onStepMonth(1)}
            direction="next"
            disabled={!canStepForward}
            disabledHint={m.count_month_latest()}
          />
        </div>

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
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/15 lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.id} className="bg-strip-cell min-w-0 p-3 sm:p-3.5">
            <dt className="text-on-strip-muted text-[9px] font-bold tracking-[0.11em] uppercase">
              {figure.key}
            </dt>
            <dd
              title={figure.isText ? figure.value : undefined}
              className={`font-display tnum text-on-strip mt-1.5 truncate text-xl font-bold sm:text-[22px] ${
                figure.isText ? 'sm:text-[19px]' : ''
              }`}
            >
              {figure.value}
            </dd>
            {figure.note && (
              <p
                className={`mt-1 truncate text-[10.5px] font-semibold ${
                  figure.tone === 'delta' ? 'text-delta' : 'text-on-strip-muted'
                }`}
              >
                {figure.note}
              </p>
            )}
            {figure.sub && (
              <p className="text-on-strip-muted truncate text-[10.5px] font-semibold">
                {figure.sub}
              </p>
            )}
          </div>
        ))}
      </dl>
    </section>
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
