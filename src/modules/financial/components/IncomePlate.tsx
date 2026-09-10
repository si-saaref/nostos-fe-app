import { memo, useId, useRef } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { formatCurrency } from '@/utils/formatters'
import { useDismiss } from '@/hooks/useDismiss'
import { RIM_CLASS } from '@/theme/rims'
import type { RimIndex } from '@/theme/rims'
import type { Income } from '@/types/income'

interface Props {
  income: Income
  /** Rim of the source the money landed in — where it now is. */
  rim: RimIndex
  /** Resolved from `income.typeId` by the page, like `fromName` and `toName`. */
  typeName: string
  fromName: string | null
  toName: string
  recorderName: string
  isOpen: boolean
  /** Takes the id so the callback stays stable across the whole statement. */
  onToggle: (id: string) => void
  currency: string
  canManage: boolean
  onEdit?: (income: Income) => void
  onDelete?: (income: Income) => void
}

const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

/**
 * One row of the statement.
 *
 * The whole design problem of this surface lives in its amount column. An
 * external inflow raised what the household holds, so it is signed and takes
 * the positive rim. A transfer moved money between two sources the household
 * already owned, so it changed nothing and is deliberately **unsigned and
 * muted** — there is no source whose point of view would give it a sign, and a
 * `+` in front of a withdrawal is a wrong number, not a styling choice.
 *
 * What a transfer *is* travels in the route instead: a solid pill either side
 * of an arrow, against a dashed "External" pill for money from outside. Text,
 * not colour, so the distinction survives a greyscale print and a screen
 * reader.
 */
const IncomePlateBase = ({
  income,
  rim,
  typeName,
  fromName,
  toName,
  recorderName,
  isOpen,
  onToggle,
  currency,
  canManage,
  onEdit,
  onDelete,
}: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const panelId = useId()

  const isTransfer = income.fromSourceId !== null
  const amount = formatCurrency(income.amount, currency, locale)

  // Opening a row to read it is not a commitment: a click away or Escape
  // closes it again, the same gesture every editor in the app answers.
  const plateRef = useRef<HTMLElement>(null)
  useDismiss(plateRef, () => onToggle(income.id), isOpen)

  return (
    <li>
      <article
        ref={plateRef}
        className={`bg-card relative overflow-hidden rounded-lg ${
          isOpen ? 'lift-shadow' : 'plate-shadow'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-[3px] ${RIM_CLASS[rim]}`}
        />

        {/* Four columns on fixed tracks, matching the expense plate, so the
            names, the routes and the amounts each read down a column across
            the whole month. The date lives on the day shelf above. */}
        <button
          type="button"
          onClick={() => onToggle(income.id)}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex w-full flex-col gap-1 px-3 py-2 text-left sm:grid sm:h-[42px] sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_13rem_8rem] sm:items-center sm:gap-3 sm:py-0"
        >
          <span className="flex items-baseline justify-between gap-3 sm:min-w-0 sm:items-center">
            <span className="truncate pl-1 text-[12.5px] font-medium">
              {income.name}
            </span>
            <span
              className={`tnum text-[12.5px] font-semibold whitespace-nowrap sm:hidden ${
                isTransfer ? 'text-muted' : 'text-rim-1'
              }`}
            >
              {isTransfer ? amount : `+${amount}`}
            </span>
          </span>

          <span className="flex min-w-0 items-center gap-2 pl-1 sm:pl-0">
            <span
              aria-hidden="true"
              className={`grid h-4 w-4 shrink-0 place-items-center rounded text-[7px] font-bold text-white sm:h-[19px] sm:w-[19px] sm:text-[8.5px] ${RIM_CLASS[rim]}`}
            >
              {initials(recorderName)}
            </span>
            <span className="text-muted truncate text-[10px] sm:text-[11px]">
              {typeName} · {recorderName}
            </span>
          </span>

          <span className="flex items-center gap-1.5 pl-1 sm:justify-end sm:pl-0">
            <Route fromName={fromName} toName={toName} />
          </span>

          <span
            className={`tnum hidden text-right text-[12.5px] font-semibold sm:block ${
              isTransfer ? 'text-muted' : 'text-rim-1'
            }`}
          >
            {isTransfer ? amount : `+${amount}`}
          </span>
        </button>

        {isOpen && (
          <div id={panelId} className="border-hair border-t px-3 pt-3 pb-3">
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <DetailField label={m.inc_plate_type()} value={typeName} />
              <DetailField
                label={m.inc_plate_from()}
                value={fromName ?? m.inc_form_from_external()}
              />
              <DetailField label={m.inc_plate_into()} value={toName} />
              <DetailField
                label={m.plate_recorded_by()}
                value={
                  income.createdAt
                    ? `${recorderName} · ${new Intl.DateTimeFormat(locale, {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(income.createdAt))}`
                    : recorderName
                }
              />
            </dl>

            {/* Both sides of the movement, in figures and then in a sentence.
                The figures show that the two cancel; the sentence says why
                that matters, because "−400k here, +400k there" is only
                obviously harmless once someone has said so. */}
            <div className="border-hair mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
              <p className="flex items-center gap-2 text-[11px] font-bold">
                {isTransfer && (
                  <>
                    <span className="text-muted">
                      {fromName}{' '}
                      <span className="font-display tnum text-[13px]">
                        −{amount}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-muted">
                      →
                    </span>
                  </>
                )}
                <span className="text-rim-1">
                  {toName}{' '}
                  <span className="font-display tnum text-[13px]">
                    +{amount}
                  </span>
                </span>
              </p>
              <p className="text-muted text-[10.5px] font-semibold">
                {isTransfer ? m.inc_effect_transfer() : m.inc_effect_external()}
              </p>
            </div>

            <div className="border-hair mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <p className="text-muted text-[9.5px] leading-relaxed">
                {income.updatedAt
                  ? new Intl.DateTimeFormat(locale, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(income.updatedAt))
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
                    onClick={() => onEdit?.(income)}
                    className="border-hair rounded-lg border px-3 py-1.5 text-[10.5px] font-semibold"
                  >
                    {m.plate_edit()}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete?.(income)}
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

/**
 * Where the money came from and where it went.
 *
 * The dashed pill is the whole vocabulary: solid means one of the household's
 * own sources, dashed means outside it. Two solid pills is a transfer; dashed
 * then solid is income. Read left to right, in the direction the money moved.
 */
const Route = ({
  fromName,
  toName,
}: {
  fromName: string | null
  toName: string
}) => {
  const m = useMessages()
  return (
    <>
      <span
        className={
          fromName === null
            ? 'border-hair text-muted shrink-0 rounded-md border border-dashed px-1.5 py-0.5 text-[9.5px] font-bold whitespace-nowrap'
            : 'bg-chip max-w-[8.5rem] truncate rounded-md px-1.5 py-0.5 text-[9.5px] font-bold'
        }
      >
        {fromName ?? m.inc_external()}
      </span>
      <span aria-hidden="true" className="text-muted text-[10px]">
        →
      </span>
      <span className="bg-chip max-w-[8.5rem] truncate rounded-md px-1.5 py-0.5 text-[9.5px] font-bold">
        {toName}
      </span>
    </>
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
 * Memoised for the same reason `ExpensePlate` is: opening one row must not
 * re-render the rest of the month. Every prop is a primitive or held stable by
 * the page.
 */
export const IncomePlate = memo(IncomePlateBase)
