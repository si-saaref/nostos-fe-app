import { useMessages } from '@/i18n/useMessages'
import { memo, useId } from 'react'
import { useSettings } from '@/contexts/useSettings'
import { formatCurrency } from '@/utils/formatters'
import { fromIsoDay } from '@/utils/dates'
import { RIM_CLASS } from '@/theme/rims'
import type { RimIndex } from '@/theme/rims'
import type { Baseline, Verdict } from '@/modules/financial/types/baseline'
import type { Expense } from '@/types/expense'

interface Props {
  expense: Expense
  rim: RimIndex
  typeName: string
  sourceName: string
  payerName: string
  recorderName: string
  verdict: Verdict
  baseline?: Baseline
  recent: Expense[]
  isOpen: boolean
  /** Takes the id so the callback can be stable across a tape of 200 rows. */
  onToggle: (id: string) => void
  currency: string
  canManage: boolean
  onDelete?: (expense: Expense) => void
}

const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

/**
 * A row is a plate: the category lives in its coloured rim, never in the text,
 * so every character keeps full contrast across a month of rows. Pulling a
 * plate lifts it out of the rack in place — no modal, and no per-row buttons
 * cluttering the other 186 rows.
 */
const ExpensePlateBase = ({
  expense,
  rim,
  typeName,
  sourceName,
  payerName,
  recorderName,
  verdict,
  baseline,
  recent,
  isOpen,
  onToggle,
  currency,
  canManage,
  onDelete,
}: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const panelId = useId()

  // Tallest bar in the sparkline, computed once rather than once per bar. The
  // `|| 1` keeps an all-zero history from dividing into a NaN height.
  const peak = Math.max(...recent.map((item) => item.value), expense.value) || 1

  const marker =
    verdict.kind === 'high'
      ? {
          text: m.baseline_higher({
            factor: (Math.round(verdict.factor * 10) / 10).toLocaleString(
              locale,
            ),
          }),
          className: 'text-rim-4',
        }
      : verdict.kind === 'low'
        ? {
            text: m.baseline_lower({
              factor: (
                Math.round((1 / verdict.factor) * 10) / 10
              ).toLocaleString(locale),
            }),
            className: 'text-rim-1',
          }
        : verdict.kind === 'cheapest'
          ? { text: m.baseline_cheapest(), className: 'text-rim-1' }
          : verdict.kind === 'bigForCategory'
            ? {
                text: m.baseline_big_for_category({ category: typeName }),
                className: 'text-rim-4',
              }
            : null

  return (
    <li>
      <article
        className={`bg-card relative overflow-hidden rounded-lg ${
          isOpen ? 'lift-shadow' : 'plate-shadow'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-[3px] ${RIM_CLASS[rim]}`}
        />

        <button
          type="button"
          onClick={() => onToggle(expense.id)}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex w-full flex-col gap-1 px-3 py-2 text-left sm:h-[42px] sm:flex-row sm:items-center sm:gap-3 sm:py-0"
        >
          <span className="flex items-baseline justify-between gap-3 sm:flex-1 sm:items-center">
            <span className="truncate pl-1 text-[12.5px] font-medium">
              {expense.name}
            </span>
            <span className="tnum text-[12.5px] font-semibold whitespace-nowrap sm:hidden">
              {formatCurrency(expense.value, currency, locale)}
            </span>
          </span>

          <span className="flex items-center gap-2 pl-1 sm:contents">
            <span
              aria-hidden="true"
              className={`grid h-4 w-4 shrink-0 place-items-center rounded text-[7px] font-bold text-white sm:h-[19px] sm:w-[19px] sm:text-[8.5px] ${RIM_CLASS[rim]}`}
            >
              {initials(payerName)}
            </span>
            <span className="text-muted truncate text-[10px] sm:w-[190px] sm:text-[11px]">
              {typeName} · {sourceName} · {payerName}
            </span>
            {marker && (
              <span
                className={`ml-auto text-[9.5px] font-bold whitespace-nowrap sm:ml-0 sm:w-[120px] sm:text-right ${marker.className}`}
              >
                {marker.text}
              </span>
            )}
            {!marker && <span className="sm:w-[120px]" />}
          </span>

          <span className="tnum hidden w-[92px] text-right text-[12.5px] font-semibold sm:block">
            {formatCurrency(expense.value, currency, locale)}
          </span>
        </button>

        {isOpen && (
          <div id={panelId} className="border-hair border-t px-3 pt-3 pb-3">
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <DetailField label={m.plate_category()} value={typeName} />
              <DetailField label={m.plate_method()} value={sourceName} />
              <DetailField label={m.plate_paid_by()} value={payerName} />
              <DetailField
                label={m.plate_recorded_by()}
                value={
                  expense.createdAt
                    ? `${recorderName} · ${new Intl.DateTimeFormat(locale, {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(expense.createdAt))}`
                    : recorderName
                }
              />
            </dl>

            <div className="border-hair mt-3 border-t pt-3">
              <p className="text-muted text-[8.5px] font-bold tracking-[0.11em] uppercase">
                {m.baseline_title()}
              </p>

              {!baseline ? (
                <p className="text-muted mt-1.5 text-[11px]">
                  {verdict.kind === 'bigForCategory'
                    ? `${m.baseline_no_history()} ${m.baseline_big_for_category({ category: typeName })} — ${m.baseline_enough_to_ask()}.`
                    : m.baseline_not_enough()}
                </p>
              ) : (
                <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end">
                  <ul className="flex h-12 flex-1 items-end gap-1.5">
                    {recent.map((item) => {
                      const isCurrent = item.id === expense.id
                      return (
                        <li
                          key={item.id}
                          className="flex flex-1 flex-col items-center gap-1"
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              height: `${Math.max(6, (item.value / peak) * 100)}%`,
                            }}
                            className={`w-full rounded-t-sm ${
                              isCurrent ? 'bg-bar-now' : 'bg-bar opacity-60'
                            }`}
                          />
                          <span className="text-muted text-[7.5px] font-semibold">
                            {new Intl.DateTimeFormat(locale, {
                              month: 'short',
                            }).format(fromIsoDay(item.datePaid))}
                          </span>
                        </li>
                      )
                    })}
                  </ul>

                  <p className="text-muted flex-1 text-[11px] leading-relaxed">
                    {m.baseline_usual({
                      range: `${formatCurrency(Math.round(baseline.low), currency, locale)} – ${formatCurrency(Math.round(baseline.high), currency, locale)}`,
                    })}{' '}
                    {marker && (
                      <span className="text-ink font-semibold">
                        {marker.text} — {m.baseline_enough_to_ask()}.
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="border-hair mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <p className="text-muted text-[9.5px] leading-relaxed">
                {expense.updatedAt
                  ? new Intl.DateTimeFormat(locale, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(expense.updatedAt))
                  : m.plate_never_edited()}
                <br />
                {m.plate_history_kept()}
              </p>

              {canManage && (
                <div className="flex items-center gap-2">
                  <span className="text-muted text-[8px] font-bold tracking-[0.08em] uppercase">
                    {m.plate_admin_only()}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDelete?.(expense)}
                    className="border-danger-line bg-danger-bg text-danger rounded-lg border px-3 py-1.5 text-[10.5px] font-semibold"
                  >
                    {m.plate_delete()}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </article>
    </li>
  )
}

const DetailField = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-muted text-[8.5px] font-bold tracking-[0.11em] uppercase">
      {label}
    </dt>
    <dd className="mt-1 text-[11px] font-medium">{value}</dd>
  </div>
)

/**
 * Memoised: a month is ~200 plates and opening one must not re-render the other
 * 199. Every prop above is either a primitive or a value the page holds stable.
 */
export const ExpensePlate = memo(ExpensePlateBase)
