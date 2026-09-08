import { useMessages } from '@/i18n/useMessages'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDeleteExpense } from '@/modules/financial/api/expenses'
import { useActiveCategories } from '@/modules/settings/api/categories'
import { useActiveAccounts } from '@/modules/settings/api/accounts'
import { useRoster } from '@/modules/settings/api/members'
import { useHousehold } from '@/contexts/useHousehold'
import { useSettings } from '@/contexts/useSettings'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CountStrip } from '@/modules/financial/components/CountStrip'
import { ExpenseFilter } from '@/modules/financial/components/ExpenseFilter'
import { ExpenseForm } from '@/modules/financial/components/ExpenseForm'
import { ExpenseTape } from '@/modules/financial/components/ExpenseTape'
import { MonthRail } from '@/modules/financial/components/MonthRail'
import { useItemBaselines } from '@/modules/financial/hooks/useItemBaselines'
import { useExpenseFilters } from '@/modules/financial/hooks/useExpenseFilters'
import { canManageExpenses } from '@/utils/permissions'
import { getErrorMessage } from '@/utils/errors'
import { rimFor } from '@/theme/rims'
import { sumMoney } from '@/utils/money'
import type {
  DayGroup,
  DayTotal,
  ScopeChip,
  TopSlice,
} from '@/modules/financial/types/ledger'
import type { Expense } from '@/types/expense'

/**
 * One reading measure for every band of the page, so nothing sits off-grid.
 * Capped well short of a wide monitor: a ledger row two thousand pixels across
 * asks the eye to carry a name all the way to an amount, and loses it.
 */
const MEASURE = 'mx-auto w-full max-w-[1320px]'

export const ExpensesPage = () => {
  const m = useMessages()
  const { householdId, role } = useHousehold()
  const { locale } = useSettings()
  const {
    filters,
    updateFilters,
    isNarrowed,
    month,
    setMonth,
    stepMonth,
    canStepForward,
    data,
    isLoading,
    isError,
    refetch,
  } = useExpenseFilters(householdId)

  const { data: categories } = useActiveCategories(householdId)
  const { data: accounts } = useActiveAccounts(householdId)
  const { data: users } = useRoster(householdId)
  const { judge, baselineFor, recentFor } = useItemBaselines(householdId)
  const { mutate: deleteExpense, error: deleteError } =
    useDeleteExpense(householdId)

  const [openId, setOpenId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [scrolledDate, setScrolledDate] = useState<string | undefined>()
  const [atEnd, setAtEnd] = useState(true)
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null)
  // The row being corrected. Separate state from `showForm` so opening an edit
  // never silently discards a half-typed new entry.
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null)
  const dayNodes = useRef(new Map<string, HTMLElement>())
  const scrollRef = useRef<HTMLDivElement>(null)

  const expenses = useMemo(() => data?.items ?? [], [data])

  /** Group the tape into day shelves, newest first. */
  const groups = useMemo<DayGroup[]>(() => {
    const byDay = new Map<string, Expense[]>()
    expenses.forEach((expense) => {
      const bucket = byDay.get(expense.datePaid)
      if (bucket) bucket.push(expense)
      else byDay.set(expense.datePaid, [expense])
    })
    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, rows]) => ({
        date,
        expenses: rows,
        total: sumMoney(rows.map((row) => row.value)),
      }))
  }, [expenses])

  const days = useMemo<DayTotal[]>(
    () =>
      groups.map((group) => ({
        date: group.date,
        total: group.total,
        count: group.expenses.length,
      })),
    [groups],
  )

  // Derived, never stored: before any scroll the newest day is the one in view.
  //
  // The end of the tape is decided by scroll position rather than by the
  // observer below. Its detection band is the top of the viewport, and the
  // oldest day can never reach it — there is nothing underneath it to scroll —
  // so the rail used to stay stuck on the 3rd while the 1st sat on screen. When
  // the tape does not overflow at all, every day is in view and the oldest one
  // is honestly the one you have read through.
  //
  // Clamped to a day that is actually on the tape: narrowing the filters can
  // drop the day you had scrolled to, and a cumulative total counted up to a
  // day that is no longer shown is the whole filtered sum wearing a date.
  const activeDate = atEnd
    ? days[days.length - 1]?.date
    : days.some((day) => day.date === scrolledDate)
      ? scrolledDate
      : days[0]?.date

  /** Spend from the newest day down to the day currently in view. */
  const cumulative = useMemo(() => {
    if (!activeDate) return data?.totals?.sum ?? 0
    const upToActive: number[] = []
    for (const group of groups) {
      upToActive.push(group.total)
      if (group.date === activeDate) break
    }
    return sumMoney(upToActive)
  }, [groups, activeDate, data])

  const registerDay = useCallback(
    (date: string, element: HTMLElement | null) => {
      if (element) dayNodes.current.set(date, element)
      else dayNodes.current.delete(date)
    },
    [],
  )

  // The rail reports where you are, so it has to follow the scroll rather than
  // only respond to clicks.
  useEffect(() => {
    const root = scrollRef.current
    const nodes = [...dayNodes.current.entries()]

    const readEnd = () => {
      if (!root) return
      setAtEnd(root.scrollTop + root.clientHeight >= root.scrollHeight - 2)
    }
    readEnd()
    root?.addEventListener('scroll', readEnd, { passive: true })
    window.addEventListener('resize', readEnd)

    const observer =
      nodes.length > 0
        ? new IntersectionObserver(
            (entries) => {
              const topmost = entries
                .filter((entry) => entry.isIntersecting)
                .sort(
                  (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
                )[0]
              if (!topmost) return
              const match = nodes.find(([, node]) => node === topmost.target)
              if (match) setScrolledDate(match[0])
            },
            { root, rootMargin: '0px 0px -75% 0px', threshold: 0 },
          )
        : null
    nodes.forEach(([, node]) => observer?.observe(node))

    return () => {
      observer?.disconnect()
      root?.removeEventListener('scroll', readEnd)
      window.removeEventListener('resize', readEnd)
    }
  }, [groups])

  const jumpTo = useCallback((date: string) => {
    setScrolledDate(date)
    dayNodes.current
      .get(date)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // Stable identities: the tape memoises each plate, and a lookup rebuilt every
  // render would re-render all 200 of them on every disclosure toggle.
  const rimOf = useCallback(
    (typeId: string) =>
      rimFor(
        categories?.find((category) => category.id === typeId)?.order ?? 0,
      ),
    [categories],
  )
  const nameOfType = useCallback(
    (typeId: string) =>
      categories?.find((category) => category.id === typeId)?.name ?? '—',
    [categories],
  )
  const nameOfSource = useCallback(
    (sourceId: string) =>
      accounts?.find((account) => account.id === sourceId)?.name ?? '—',
    [accounts],
  )
  const nameOfUser = useCallback(
    (userId: string) =>
      users?.find((member) => member.id === userId)?.name ?? '—',
    [users],
  )
  const toggleOpen = useCallback(
    (id: string) => setOpenId((current) => (current === id ? null : id)),
    [],
  )
  const requestEdit = useCallback((expense: Expense) => {
    setExpenseToEdit(expense)
    // The plate's disclosure and the edit panel would otherwise show the same
    // row twice, in two places, with two sets of values.
    setOpenId(null)
  }, [])
  const requestDelete = useCallback(
    (expense: Expense) => setExpenseToDelete(expense),
    [],
  )

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(month)

  const canManage = canManageExpenses(role)
  const activeCategory = categories?.find(
    (category) => category.id === filters.typeId,
  )
  const activeAccount = accounts?.find(
    (account) => account.id === filters.sourceId,
  )
  const activeMember = users?.find(
    (member) => member.id === filters.paidByUserId,
  )

  /**
   * Every narrowing the totals are counting under, in the order the filter row
   * offers them. Stated on the strip because a filter-scoped total with an
   * unstated filter misreports, and removable there for the same reason.
   */
  const scopes = useMemo<ScopeChip[]>(() => {
    const list: ScopeChip[] = []
    if (activeCategory)
      list.push({
        id: 'typeId',
        label: activeCategory.name,
        rim: rimFor(activeCategory.order),
      })
    if (activeAccount) list.push({ id: 'sourceId', label: activeAccount.name })
    if (activeMember)
      list.push({ id: 'paidByUserId', label: activeMember.name })
    if (filters.search)
      list.push({ id: 'search', label: `“${filters.search}”` })
    return list
  }, [activeCategory, activeAccount, activeMember, filters.search])

  const removeScope = (id: ScopeChip['id']) =>
    updateFilters({ [id]: undefined, page: 1 })

  /**
   * The biggest single contributor to the filtered spend.
   *
   * There is no grouped-aggregate endpoint, so this is summed from the rows the
   * page is holding — which makes it honest only while it holds all of them.
   * Once a category is already filtered, "where it went" would answer itself,
   * so the breakdown moves to who paid.
   */
  const slice = useMemo<TopSlice | null>(() => {
    const total = data?.totals?.sum ?? 0
    const inScope = data?.pagination?.total ?? expenses.length
    if (total <= 0 || expenses.length < inScope) return null

    const kind: TopSlice['kind'] = filters.typeId ? 'member' : 'category'
    const keyOf = (expense: Expense) =>
      kind === 'member' ? expense.paidByUserId : expense.typeId
    const nameOf = kind === 'member' ? nameOfUser : nameOfType

    const byKey = new Map<string, number>()
    expenses.forEach((expense) => {
      const key = keyOf(expense)
      byKey.set(key, (byKey.get(key) ?? 0) + expense.value)
    })

    const ranked = [...byKey.entries()].sort((a, b) => b[1] - a[1])
    const top = ranked[0]
    if (!top) return null
    const share = (value: number) => Math.round((value / total) * 100)
    const second = ranked[1]

    return {
      kind,
      name: nameOf(top[0]),
      amount: sumMoney([top[1]]),
      pct: share(top[1]),
      runnerUp: second
        ? { name: nameOf(second[0]), pct: share(second[1]) }
        : undefined,
    }
  }, [expenses, data, filters.typeId, nameOfType, nameOfUser])

  return (
    <section className="flex h-full flex-col">
      {/* Pinned: the count and the filters never scroll away from the ledger
          they describe, because a total you cannot see cannot be trusted. */}
      <div
        className={`${MEASURE} flex shrink-0 flex-col gap-3 px-4 pt-4 pb-3 lg:px-6`}
      >
        <CountStrip
          householdId={householdId}
          filters={filters}
          totals={data?.totals}
          month={month}
          onStepMonth={stepMonth}
          onSelectMonth={setMonth}
          canStepForward={canStepForward}
          scopes={scopes}
          onRemoveScope={removeScope}
          slice={slice}
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-60 flex-1">
            <ExpenseFilter
              householdId={householdId}
              filters={filters}
              onChange={updateFilters}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowForm((open) => !open)}
            className="bg-accent text-accent-ink hidden rounded-lg px-4 py-2 text-[12px] font-semibold lg:block"
          >
            + {m.action_record_long()}
          </button>
        </div>

        {showForm && (
          <div className="bg-card lift-shadow rounded-xl p-4">
            <ExpenseForm
              onSuccess={() => setShowForm(false)}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {expenseToEdit && (
          <div className="bg-card lift-shadow rounded-xl p-4">
            <h2 className="font-display mb-3 text-[12.5px] font-bold">
              {m.expense_edit_title({ name: expenseToEdit.name })}
            </h2>
            {/* Keyed on the row: hitting Edit on a second plate while one is
                open must reset the fields, not keep the first row's values. */}
            <ExpenseForm
              key={expenseToEdit.id}
              expense={expenseToEdit}
              onSuccess={() => setExpenseToEdit(null)}
              onCancel={() => setExpenseToEdit(null)}
            />
          </div>
        )}

        {deleteError && (
          <p
            role="alert"
            className="border-danger-line bg-danger-bg text-danger rounded-lg border px-3 py-2 text-[11px]"
          >
            {getErrorMessage(deleteError)}
          </p>
        )}
      </div>

      <div className={`${MEASURE} flex min-h-0 flex-1 gap-4 px-4 pb-4 lg:px-6`}>
        <MonthRail
          days={days}
          rangeFrom={filters.dateFrom}
          rangeTo={filters.dateTo}
          activeDate={activeDate}
          onJump={jumpTo}
          cumulative={cumulative}
          monthTotal={data?.totals?.sum ?? 0}
        />

        <div
          ref={scrollRef}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1 pb-24 lg:pb-2"
        >
          {isLoading && (
            <p
              role="status"
              aria-live="polite"
              className="text-muted py-8 text-sm"
            >
              {m.tape_loading()}
            </p>
          )}

          {isError && (
            <div role="alert" className="bg-card plate-shadow rounded-xl p-6">
              <p className="text-sm font-semibold">{m.tape_error()}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="bg-accent text-accent-ink mt-3 rounded-lg px-3 py-2 text-[12px] font-semibold"
              >
                {m.tape_retry()}
              </button>
            </div>
          )}

          {/* Month-scoped, now that the month can be changed. "No expenses
              yet" was a claim about the household; an empty March is a fact
              about March, and the household may have ninety-nine entries in
              August. */}
          {!isLoading && !isError && groups.length === 0 && (
            <div className="bg-card plate-shadow rounded-xl p-8 text-center">
              <h2 className="font-display text-base font-bold">
                {isNarrowed
                  ? m.tape_empty_filtered()
                  : m.tape_empty_month({ month: monthLabel })}
              </h2>
              {!isNarrowed && (
                <p className="text-muted mx-auto mt-2 max-w-sm text-[12px] leading-relaxed">
                  {m.tape_empty_month_body()}
                </p>
              )}
            </div>
          )}

          {!isLoading && !isError && groups.length > 0 && (
            <ExpenseTape
              groups={groups}
              rimOf={rimOf}
              nameOfType={nameOfType}
              nameOfSource={nameOfSource}
              nameOfUser={nameOfUser}
              judge={judge}
              baselineFor={baselineFor}
              recentFor={recentFor}
              openId={openId}
              onToggle={toggleOpen}
              registerDay={registerDay}
              canManage={canManage}
              onEdit={requestEdit}
              onDelete={requestDelete}
            />
          )}
        </div>

        {/* Thumb-reachable day index; the rail's mobile form. */}
        <div className="shrink-0 self-start pt-1 lg:hidden">
          <MonthRail
            variant="index"
            days={days}
            activeDate={activeDate}
            onJump={jumpTo}
            cumulative={cumulative}
            monthTotal={data?.totals?.sum ?? 0}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowForm((open) => !open)}
        className="bg-accent text-accent-ink fixed right-4 bottom-20 z-30 flex h-12 items-center gap-2 rounded-xl px-5 text-[13px] font-semibold shadow-lg lg:hidden"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          +
        </span>
        {m.action_record()}
      </button>

      {/* Deleting a money record is irreversible, so it asks — the settings
          module already stops for the *less* destructive archive. */}
      <ConfirmDialog
        open={Boolean(expenseToDelete)}
        onOpenChange={(open) => !open && setExpenseToDelete(null)}
        title={m.expense_delete_title({ name: expenseToDelete?.name ?? '' })}
        body={m.expense_delete_body()}
        confirmLabel={m.expense_delete_confirm()}
        destructive
        onConfirm={() => {
          if (expenseToDelete) deleteExpense(expenseToDelete.id)
          setExpenseToDelete(null)
          setOpenId(null)
        }}
      />
    </section>
  )
}
