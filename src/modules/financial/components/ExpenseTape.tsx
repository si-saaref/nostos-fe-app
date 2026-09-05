import { useMemo } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { ExpensePlate } from '@/modules/financial/components/ExpensePlate'
import { isOptimisticId } from '@/modules/financial/api/expenses'
import { formatCurrency } from '@/utils/formatters'
import { fromIsoDay } from '@/utils/dates'
import type { RimIndex } from '@/theme/rims'
import type { Baseline, Verdict } from '@/modules/financial/types/baseline'
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
  recentFor: (name: string) => Expense[]
  openId: string | null
  onToggle: (id: string) => void
  canManage: boolean
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
  onDelete,
  registerDay,
}: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const currency = useCurrency()

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
          className="scroll-mt-4"
        >
          <header className="flex items-center gap-2.5 pt-3 pb-1.5">
            <h3 className="font-display text-[11px] font-bold tracking-[0.11em] uppercase">
              {new Intl.DateTimeFormat(locale, {
                weekday: 'short',
                day: 'numeric',
                month: 'long',
              }).format(fromIsoDay(group.date))}
            </h3>
            <span
              aria-hidden="true"
              className="bg-bar h-0.5 flex-1 rounded-full opacity-45"
            />
            <span className="tnum text-[10.5px] font-semibold whitespace-nowrap">
              {formatCurrency(group.total, currency, locale)} ·{' '}
              {m.tape_entries_short({ n: group.expenses.length })}
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
                onDelete={onDelete}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
