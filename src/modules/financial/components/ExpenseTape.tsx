import { useMemo } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { ExpensePlate } from '@/modules/financial/components/ExpensePlate'
import { isOptimisticId } from '@/modules/financial/api/expenses'
import { formatCurrency } from '@/utils/formatters'
import { fromIsoDay } from '@/utils/dates'
import type { RimIndex } from '@/theme/rims'
import type {
  Baseline,
  RecentPoint,
  Verdict,
} from '@/modules/financial/types/baseline'
import type { DayGroup } from '@/modules/financial/types/ledger'
import type { Expense } from '@/types/expense'

interface Props {
  groups: DayGroup[]
  rimOf: (typeId: string) => RimIndex
  nameOfType: (typeId: string) => string
  nameOfSource: (sourceId: string) => string
  nameOfUser: (userId: string) => string
  judge: (expense: Expense) => Verdict
  baselineFor: (name: string) => Baseline | undefined
  recentFor: (name: string) => RecentPoint[]
  openId: string | null
  onToggle: (id: string) => void
  canManage: boolean
  onEdit?: (expense: Expense) => void
  onDelete?: (expense: Expense) => void
  registerDay: (date: string, element: HTMLElement | null) => void
}

/** Referentially stable stand-in, so a missing row still memoises cleanly. */
const UNKNOWN: Verdict = { kind: 'unknown' }

/**
 * One continuous tape, newest first — the order a member expects the moment
 * after they record something. Day groups are shelves, each carrying its own
 * subtotal, so a month reads as days rather than as one undifferentiated list.
 */
export const ExpenseTape = ({
  groups,
  rimOf,
  nameOfType,
  nameOfSource,
  nameOfUser,
  judge,
  baselineFor,
  recentFor,
  openId,
  onToggle,
  canManage,
  onEdit,
  onDelete,
  registerDay,
}: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const currency = useCurrency()

  /** A day with one expense on it does not have "1 entries" on it. */
  const countLabel = (n: number) =>
    n === 1 ? m.tape_entries_one() : m.tape_entries_short({ n })

  // Judged once per group change rather than once per render: `judge` returns a
  // fresh object each call, which would hand every plate a new prop and undo
  // the memoisation the tape depends on at 200 rows.
  const verdicts = useMemo(() => {
    const byId = new Map<string, Verdict>()
    groups.forEach((group) =>
      group.expenses.forEach((expense) => byId.set(expense.id, judge(expense))),
    )
    return byId
  }, [groups, judge])

  return (
    <div className="flex flex-col">
      {groups.map((group) => (
        <section
          key={group.date}
          ref={(element) => registerDay(group.date, element)}
          aria-label={new Intl.DateTimeFormat(locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }).format(fromIsoDay(group.date))}
          className="scroll-mt-2 pt-6 first:pt-1"
        >
          {/* A day is a group, and the spacing has to say so: 24px above the
              header against 6px between its rows. Sticky, because a day with
              thirty entries otherwise loses its own date off the top. */}
          <header className="bg-ground sticky top-0 z-10 flex items-center gap-3 pb-2">
            <h3 className="font-display text-[11px] font-bold tracking-[0.12em] uppercase">
              {new Intl.DateTimeFormat(locale, {
                weekday: 'short',
                day: 'numeric',
                month: 'long',
              }).format(fromIsoDay(group.date))}
            </h3>
            <span aria-hidden="true" className="bg-hair h-px flex-1" />
            {/* The day's subtotal outranks any single row in it, so it is not
                set smaller than the amounts it adds up. */}
            <span className="tnum text-[12px] whitespace-nowrap">
              <span className="font-semibold">
                {formatCurrency(group.total, currency, locale)}
              </span>
              <span className="text-muted font-medium">
                {' · '}
                {countLabel(group.expenses.length)}
              </span>
            </span>
          </header>

          <ul className="flex flex-col gap-1.5">
            {group.expenses.map((expense) => (
              <ExpensePlate
                key={expense.id}
                expense={expense}
                rim={rimOf(expense.typeId)}
                typeName={nameOfType(expense.typeId)}
                sourceName={nameOfSource(expense.sourceId)}
                payerName={nameOfUser(expense.paidByUserId)}
                recorderName={nameOfUser(
                  expense.createdByUserId ?? expense.paidByUserId,
                )}
                verdict={verdicts.get(expense.id) ?? UNKNOWN}
                baseline={baselineFor(expense.name)}
                recent={recentFor(expense.name)}
                isOpen={openId === expense.id}
                onToggle={onToggle}
                currency={currency}
                // A row the server has not acknowledged has no id worth acting
                // on: deleting it would address a record that does not exist.
                canManage={canManage && !isOptimisticId(expense.id)}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
