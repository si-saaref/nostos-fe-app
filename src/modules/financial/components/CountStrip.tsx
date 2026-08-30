import { useMessages } from '@/i18n/useMessages'
import { useExpenses } from '@/api/queries/expenses'
import { useSettings } from '@/contexts/useSettings'
import { formatCurrency } from '@/utils/formatters'
import { fromIsoDay, previousMonthRange } from '@/utils/dates'
import type { ExpenseFilters, Totals } from '@/types/expense'

interface Props {
  householdId: string
  filters: ExpenseFilters
  totals?: Totals
  /** Sum of the filtered set paid by the signed-in person. */
  yourShare: number
  categoryLabel?: string
  memberLabel?: string
}

const monthLabel = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    fromIsoDay(iso),
  )

/**
 * The count, announced in front of everyone — and it always prints the scope
 * it is counting. `totals` follows the filters, so a figure without its range
 * and filters attached is a confident lie the moment anything is narrowed.
 */
export const CountStrip = ({
  householdId,
  filters,
  totals,
  yourShare,
  categoryLabel,
  memberLabel,
}: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const previous = previousMonthRange(fromIsoDay(filters.dateFrom ?? ''))

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

  const days = Math.max(
    1,
    Math.round(
      (fromIsoDay(filters.dateTo ?? '').getTime() -
        fromIsoDay(filters.dateFrom ?? '').getTime()) /
        86_400_000,
    ) + 1,
  )
  const perDay = Math.round((count / days) * 10) / 10
  const sharePct = sum > 0 ? Math.round((yourShare / sum) * 100) : 0

  const figures = [
    {
      key: m.count_total(),
      value: formatCurrency(sum, 'IDR', locale),
      note:
        deltaPct === null
          ? null
          : m.count_vs_previous({
              pct: `${deltaPct > 0 ? '▲' : '▼'} ${Math.abs(deltaPct).toLocaleString(locale)}%`,
              month: monthLabel(previous.from, locale),
            }),
      tone: deltaPct !== null && deltaPct > 0 ? 'delta' : 'muted',
    },
    {
      key: m.count_previous(),
      value: previousQuery.isLoading
        ? '—'
        : formatCurrency(previousSum, 'IDR', locale),
      note: previousTotals
        ? m.tape_entries_short({ n: previousTotals.count })
        : null,
      tone: 'muted',
    },
    {
      key: m.count_entries(),
      value: String(count),
      note: m.count_avg({ amount: formatCurrency(average, 'IDR', locale) }),
      tone: 'muted',
      sub: m.count_per_day({ n: perDay.toLocaleString(locale) }),
    },
    {
      key: m.count_yours(),
      value: formatCurrency(yourShare, 'IDR', locale),
      note: m.count_share_of_total({ pct: `${sharePct}%` }),
      tone: 'muted',
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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-display text-strip-key text-[10px] font-bold tracking-[0.15em] uppercase">
          {m.count_title()}
        </h2>
        <ScopePill>{monthLabel(filters.dateFrom ?? '', locale)}</ScopePill>
        <ScopePill>
          {categoryLabel ?? m.count_scope_all({ what: m.count_categories() })}
        </ScopePill>
        <ScopePill>
          {memberLabel ?? m.count_scope_all({ what: m.count_members() })}
        </ScopePill>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/15 lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.key} className="bg-strip-cell p-3">
            <dt className="text-on-strip-muted text-[9px] font-bold tracking-[0.11em] uppercase">
              {figure.key}
            </dt>
            <dd className="font-display tnum text-on-strip mt-1.5 text-xl font-bold sm:text-[22px]">
              {figure.value}
            </dd>
            {figure.note && (
              <p
                className={`mt-1 text-[10.5px] font-semibold ${
                  figure.tone === 'delta' ? 'text-delta' : 'text-on-strip-muted'
                }`}
              >
                {figure.note}
              </p>
            )}
            {figure.sub && (
              <p className="text-on-strip-muted text-[10.5px] font-semibold">
                {figure.sub}
              </p>
            )}
          </div>
        ))}
      </dl>
    </section>
  )
}

const ScopePill = ({ children }: { children: React.ReactNode }) => (
  <span className="text-on-strip rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold">
    {children}
  </span>
)
