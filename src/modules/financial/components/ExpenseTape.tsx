import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { ExpensePlate } from '@/modules/financial/components/ExpensePlate'
import { formatCurrency } from '@/utils/formatters'
import { fromIsoDay } from '@/utils/dates'
import type {
  Baseline,
  Verdict,
} from '@/modules/financial/hooks/useItemBaselines'
import type { Expense } from '@/types/expense'

export interface DayGroup {
  date: string
  total: number
  expenses: Expense[]
}

interface Props {
  groups: DayGroup[]
  rimOf: (typeId: string) => 1 | 2 | 3 | 4
  nameOfType: (typeId: string) => string
  nameOfSource: (sourceId: string) => string
  nameOfUser: (userId: string) => string
  judge: (expense: Expense) => Verdict
  baselineOf: (name: string) => Baseline | undefined
  recentFor: (name: string) => Expense[]
  openId: string | null
  onToggle: (id: string) => void
  canManage: boolean
  onEdit?: (expense: Expense) => void
  onDelete?: (expense: Expense) => void
  registerDay: (date: string, element: HTMLElement | null) => void
}

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
  baselineOf,
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
              {formatCurrency(group.total, 'IDR', locale)} ·{' '}
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
                verdict={judge(expense)}
                baseline={baselineOf(expense.name)}
                recent={recentFor(expense.name)}
                isOpen={openId === expense.id}
                onToggle={() => onToggle(expense.id)}
                canManage={canManage}
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
