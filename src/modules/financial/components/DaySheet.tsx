import { useId, useMemo } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { RIM_CLASS } from '@/theme/rims'
import { formatCurrency } from '@/utils/formatters'
import { fromIsoDay } from '@/utils/dates'
import type { RimIndex } from '@/theme/rims'
import type { CalendarDay } from '@/modules/financial/lib/calendarMonth'
import type { Expense } from '@/types/expense'
import type { Income } from '@/types/income'

interface Props {
  /** The open day, or `null` while none is. */
  day: CalendarDay | null
  today: string
  /** Resolves a category, source, member or income type id to its name. */
  nameOf: (id: string) => string
  /** The rim of a category or source, derived from its stable order. */
  rimOf: (id: string) => RimIndex
}

type Entry =
  | { kind: 'expense'; id: string; amount: number; row: Expense }
  | { kind: 'income'; id: string; amount: number; row: Income }

/**
 * One day, read.
 *
 * Read is the whole contract: there is no edit, no delete, no record. Two
 * ledgers already own those, each with its own confirmation and its own
 * permission gate, and a third place to change an entry is a third place for
 * the permission matrix to be wrong.
 *
 * Entries are ordered by size rather than by kind, because the question the
 * calendar is answering — what happened here — is answered by the largest
 * movement of the day, whichever ledger it came from.
 */
export const DaySheet = ({ day, today, nameOf, rimOf }: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const currency = useCurrency()
  const figuresId = useId()

  const entries = useMemo<Entry[]>(() => {
    if (!day) return []
    return [
      ...day.expenses.map((row): Entry => ({
        kind: 'expense',
        id: row.id,
        amount: row.value,
        row,
      })),
      ...day.income.map((row): Entry => ({
        kind: 'income',
        id: row.id,
        amount: row.amount,
        row,
      })),
      // Id breaks a tie, so two identical amounts cannot swap places between
      // renders and make the list look like it is moving on its own.
    ].sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id))
  }, [day])

  const money = (value: number) => formatCurrency(value, currency, locale)

  if (!day) {
    return (
      <aside className="bg-card plate-shadow rounded-2xl p-5">
        <p className="text-muted text-[12px] leading-relaxed">
          {m.cal_sheet_prompt()}
        </p>
      </aside>
    )
  }

  const heading = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(fromIsoDay(day.date))

  return (
    <aside
      aria-label={heading}
      className="bg-card plate-shadow rounded-2xl p-4 sm:p-5"
    >
      <h2 className="font-display text-[18px] font-bold tracking-[-0.01em]">
        {heading}
      </h2>
      <p className="text-muted mt-0.5 text-[11.5px]">
        {day.date === today && `${m.cal_sheet_today()} · `}
        {day.count === 1
          ? m.cal_sheet_entries_one()
          : m.cal_sheet_entries({ n: day.count })}
      </p>

      <dl
        role="group"
        aria-label={heading}
        aria-describedby={figuresId}
        className="border-hair my-3.5 grid grid-cols-3 gap-2.5 border-y py-3"
      >
        <Figure label={m.cal_out()} value={day.spent} money={money} />
        <Figure label={m.cal_in()} value={day.inflow} money={money} />
        <Figure label={m.cal_moved()} value={day.moved} money={money} />
      </dl>

      {day.count === 0 ? (
        <p id={figuresId} className="text-muted text-[12px] leading-relaxed">
          {m.cal_sheet_none()}
        </p>
      ) : (
        <>
          <ul id={figuresId} className="list-none">
            {entries.map((entry) =>
              entry.kind === 'expense' ? (
                <ExpenseRow
                  key={entry.id}
                  expense={entry.row}
                  nameOf={nameOf}
                  rim={rimOf(entry.row.typeId)}
                  money={money}
                />
              ) : (
                <IncomeRow
                  key={entry.id}
                  income={entry.row}
                  nameOf={nameOf}
                  rim={rimOf(entry.row.toSourceId)}
                  money={money}
                />
              ),
            )}
          </ul>
          <p className="border-hair text-muted mt-3 border-t pt-2.5 text-[10.5px] leading-relaxed">
            {m.cal_sheet_foot()}
          </p>
        </>
      )}
    </aside>
  )
}

/** A dash, not a zero: the day had no entry in this stream at all. */
const Figure = ({
  label,
  value,
  money,
}: {
  label: string
  value: number
  money: (value: number) => string
}) => (
  <div>
    <dt className="text-muted text-[8.5px] font-bold tracking-[0.11em] uppercase">
      {label}
    </dt>
    <dd
      className={`font-display tnum mt-1 text-[15px] font-bold ${
        value === 0 ? 'text-muted' : ''
      }`}
    >
      {value === 0 ? '—' : money(value)}
    </dd>
  </div>
)

type Kind = 'out' | 'in' | 'moved'

/**
 * The kind is stated three times over, because the rim cannot state it once.
 *
 * A rim carries *category* — Belanja, BNI — so two rows of different kinds
 * routinely wear neighbouring colours, and an expense beside a transfer was
 * distinguishable only by the presence of pills. So the amount takes a sign,
 * the colour matches the mark the same money draws on the grid above, and the
 * kind is spelled out in a word beneath the figure. Sign, hue and word: remove
 * any one and the row still reads.
 */
const KIND_TEXT: Record<Kind, string> = {
  out: 'text-flow-out',
  in: 'text-flow-in',
  moved: 'text-flow-moved',
}

const Row = ({
  rim,
  kind,
  kindLabel,
  name,
  meta,
  amount,
}: {
  rim: RimIndex
  kind: Kind
  kindLabel: string
  name: string
  meta: React.ReactNode
  /** Already signed by the caller: a transfer has no sign to carry. */
  amount: string
}) => (
  <li className="border-hair flex items-start gap-2.5 border-b py-2.5 last:border-b-0">
    <i
      className={`mt-0.5 w-[3px] self-stretch rounded-full ${RIM_CLASS[rim]}`}
    />
    <div className="min-w-0 flex-1">
      <p className="text-[12.5px] leading-snug font-semibold">{name}</p>
      <div className="text-muted mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px]">
        {meta}
      </div>
    </div>
    <div className="shrink-0 text-right">
      <span
        className={`font-display tnum block text-[13.5px] whitespace-nowrap ${
          KIND_TEXT[kind]
        } ${kind === 'moved' ? 'font-semibold' : 'font-bold'}`}
      >
        {amount}
      </span>
      <span
        className={`mt-0.5 block text-[8.5px] font-bold tracking-[0.09em] uppercase ${
          kind === 'in' ? 'text-flow-in' : 'text-muted'
        }`}
      >
        {kindLabel}
      </span>
    </div>
  </li>
)

const Dot = () => <span className="opacity-50">·</span>

const ExpenseRow = ({
  expense,
  nameOf,
  rim,
  money,
}: {
  expense: Expense
  nameOf: (id: string) => string
  rim: RimIndex
  money: (value: number) => string
}) => {
  const m = useMessages()
  return (
    <Row
      rim={rim}
      kind="out"
      kindLabel={m.cal_kind_out()}
      name={expense.name}
      // Signed, unlike on the expense ledger: there every row is an expense, so
      // a minus would be noise. Here it is the difference between two kinds.
      amount={`− ${money(expense.value)}`}
      meta={
        <>
          {nameOf(expense.typeId)}
          <Dot />
          {nameOf(expense.sourceId)}
          <Dot />
          {nameOf(expense.paidByUserId)}
        </>
      }
    />
  )
}

/**
 * The signing rule, exactly as `IncomePlate` states it: an external inflow
 * raised what the household holds and is signed; a transfer moved money it
 * already had and is unsigned and muted. What a transfer *is* travels in the
 * route — two solid pills — against a dashed pill for money from outside.
 */
const IncomeRow = ({
  income,
  nameOf,
  rim,
  money,
}: {
  income: Income
  nameOf: (id: string) => string
  rim: RimIndex
  money: (value: number) => string
}) => {
  const m = useMessages()
  const isTransfer = income.fromSourceId !== null

  return (
    <Row
      rim={rim}
      kind={isTransfer ? 'moved' : 'in'}
      kindLabel={isTransfer ? m.cal_kind_moved() : m.cal_kind_in()}
      name={income.name}
      amount={isTransfer ? money(income.amount) : `+ ${money(income.amount)}`}
      meta={
        <>
          <span
            className={`rounded px-1.5 py-px text-[10px] font-semibold ${
              isTransfer ? 'bg-chip' : 'shadow-[inset_0_0_0_1px_var(--hair)]'
            }`}
          >
            {isTransfer ? nameOf(income.fromSourceId!) : m.inc_external()}
          </span>
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h13m-4-4 4 4-4 4" />
          </svg>
          <span className="bg-chip rounded px-1.5 py-px text-[10px] font-semibold">
            {nameOf(income.toSourceId)}
          </span>
          <Dot />
          {nameOf(income.typeId)}
        </>
      }
    />
  )
}
