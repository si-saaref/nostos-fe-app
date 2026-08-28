import { useId } from 'react'
import { useSettings } from '@/contexts/useSettings'
import { formatCurrency } from '@/utils/formatters'
import { fromIsoDay } from '@/utils/dates'
import type {
  Baseline,
  Verdict,
} from '@/modules/financial/hooks/useItemBaselines'
import type { Expense } from '@/types/expense'

interface Props {
  expense: Expense
  rim: 1 | 2 | 3 | 4
  typeName: string
  sourceName: string
  payerName: string
  recorderName: string
  verdict: Verdict
  baseline?: Baseline
  recent: Expense[]
  isOpen: boolean
  onToggle: () => void
  canManage: boolean
  onEdit?: (expense: Expense) => void
  onDelete?: (expense: Expense) => void
}

const RIM_CLASS = {
  1: 'bg-rim-1',
  2: 'bg-rim-2',
  3: 'bg-rim-3',
  4: 'bg-rim-4',
} as const

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
export const ExpensePlate = ({
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
  canManage,
  onEdit,
  onDelete,
}: Props) => {
  const { t, locale } = useSettings()
  const panelId = useId()

  const marker =
    verdict.kind === 'high'
      ? {
          text: t('baseline.higher', {
            factor: (Math.round(verdict.factor * 10) / 10).toLocaleString(
              locale,
            ),
          }),
          className: 'text-rim-4',
        }
      : verdict.kind === 'low'
        ? {
            text: t('baseline.lower', {
              factor: (
                Math.round((1 / verdict.factor) * 10) / 10
              ).toLocaleString(locale),
            }),
            className: 'text-rim-1',
          }
        : verdict.kind === 'cheapest'
          ? { text: t('baseline.cheapest'), className: 'text-rim-1' }
          : verdict.kind === 'bigForCategory'
            ? {
                text: t('baseline.bigForCategory', { category: typeName }),
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
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex w-full flex-col gap-1 px-3 py-2 text-left sm:h-[42px] sm:flex-row sm:items-center sm:gap-3 sm:py-0"
        >
          <span className="flex items-baseline justify-between gap-3 sm:flex-1 sm:items-center">
            <span className="truncate pl-1 text-[12.5px] font-medium">
              {expense.name}
            </span>
            <span className="tnum text-[12.5px] font-semibold whitespace-nowrap sm:hidden">
              {formatCurrency(expense.value, 'IDR', locale)}
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
            {formatCurrency(expense.value, 'IDR', locale)}
          </span>
        </button>

        {isOpen && (
          <div id={panelId} className="border-hair border-t px-3 pt-3 pb-3">
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Field label={t('plate.category')} value={typeName} />
              <Field label={t('plate.method')} value={sourceName} />
              <Field label={t('plate.paidBy')} value={payerName} />
              <Field
                label={t('plate.recordedBy')}
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
                {t('baseline.title')}
              </p>

              {!baseline ? (
                <p className="text-muted mt-1.5 text-[11px]">
                  {verdict.kind === 'bigForCategory'
                    ? `${t('baseline.noHistory')} ${t('baseline.bigForCategory', { category: typeName })} — ${t('baseline.enoughToAsk')}.`
                    : t('baseline.notEnough')}
                </p>
              ) : (
                <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end">
                  <ul className="flex h-12 flex-1 items-end gap-1.5">
                    {recent.map((item) => {
                      const peak = Math.max(
                        ...recent.map((entry) => entry.value),
                        expense.value,
                      )
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
                    {t('baseline.usual', {
                      range: `${formatCurrency(Math.round(baseline.low), 'IDR', locale)} – ${formatCurrency(Math.round(baseline.high), 'IDR', locale)}`,
                    })}{' '}
                    {marker && (
                      <span className="text-ink font-semibold">
                        {marker.text} — {t('baseline.enoughToAsk')}.
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
                  : t('plate.neverEdited')}
                <br />
                {t('plate.historyKept')}
              </p>

              {canManage && (
                <div className="flex items-center gap-2">
                  <span className="text-muted text-[8px] font-bold tracking-[0.08em] uppercase">
                    {t('plate.adminOnly')}
                  </span>
                  <button
                    type="button"
                    onClick={() => onEdit?.(expense)}
                    className="border-hair bg-card rounded-lg border px-3 py-1.5 text-[10.5px] font-semibold"
                  >
                    {t('plate.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete?.(expense)}
                    className="border-danger-line bg-danger-bg text-danger rounded-lg border px-3 py-1.5 text-[10.5px] font-semibold"
                  >
                    {t('plate.delete')}
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

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-muted text-[8.5px] font-bold tracking-[0.11em] uppercase">
      {label}
    </dt>
    <dd className="mt-1 text-[11px] font-medium">{value}</dd>
  </div>
)
