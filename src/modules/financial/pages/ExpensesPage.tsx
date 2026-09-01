import { useMessages } from '@/i18n/useMessages'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDeleteExpense } from '@/modules/financial/api/expenses'
import { useActiveCategories } from '@/modules/settings/api/categories'
import { useActiveAccounts } from '@/modules/settings/api/accounts'
import { useUsers } from '@/modules/settings/api/members'
import { useHousehold } from '@/contexts/useHousehold'
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
import type { DayGroup, DayTotal } from '@/modules/financial/types/ledger'
import type { Expense } from '@/types/expense'

export const ExpensesPage = () => {
  const m = useMessages()
  const { householdId, role, me } = useHousehold()
  const {
    filters,
    updateFilters,
    clearFilters,
    isNarrowed,
    data,
    isLoading,
    isError,
    refetch,
  } = useExpenseFilters(householdId)

  const { data: categories } = useActiveCategories(householdId)
  const { data: accounts } = useActiveAccounts(householdId)
  const { data: users } = useUsers(householdId)
  const { judge, baselineFor, recentFor } = useItemBaselines(householdId)
  const { mutate: deleteExpense, error: deleteError } =
    useDeleteExpense(householdId)

  const [openId, setOpenId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [scrolledDate, setScrolledDate] = useState<string | undefined>()
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null)
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
        total: rows.reduce((sum, row) => sum + row.value, 0),
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
  // Clamped to a day that is actually on the tape — narrowing the filters can
  // drop the day you had scrolled to, and a cumulative total counted up to a
  // day that is no longer shown is the whole filtered sum wearing a date.
  const activeDate = days.some((day) => day.date === scrolledDate)
    ? scrolledDate
    : days[0]?.date

  /** Spend from the newest day down to the day currently in view. */
  const cumulative = useMemo(() => {
    if (!activeDate) return data?.totals?.sum ?? 0
    let sum = 0
    for (const group of groups) {
      sum += group.total
      if (group.date === activeDate) break
    }
    return sum
  }, [groups, activeDate, data])

  const yourShare = useMemo(
    () =>
      expenses
        .filter((expense) => expense.paidByUserId === me?.user_id)
        .reduce((sum, expense) => sum + expense.value, 0),
    [expenses, me],
  )

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
    const nodes = [...dayNodes.current.entries()]
    if (nodes.length === 0) return
    const observer = new IntersectionObserver(
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
      { root: scrollRef.current, rootMargin: '0px 0px -75% 0px', threshold: 0 },
    )
    nodes.forEach(([, node]) => observer.observe(node))
    return () => observer.disconnect()
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
  const requestDelete = useCallback(
    (expense: Expense) => setExpenseToDelete(expense),
    [],
  )

  const canManage = canManageExpenses(role)
  const activeCategory = categories?.find(
    (category) => category.id === filters.typeId,
  )
  const activeMember = users?.find(
    (member) => member.id === filters.paidByUserId,
  )

  return (
    <section className="flex h-full flex-col">
      {/* Pinned: the count and the filters never scroll away from the ledger
          they describe, because a total you cannot see cannot be trusted. */}
      <div className="flex shrink-0 flex-col gap-3 px-4 pt-4 pb-3 lg:px-6">
        <CountStrip
          householdId={householdId}
          filters={filters}
          totals={data?.totals}
          yourShare={yourShare}
          categoryLabel={activeCategory?.name}
          memberLabel={activeMember?.name}
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[240px] flex-1">
            <ExpenseFilter
              householdId={householdId}
              filters={filters}
              onChange={updateFilters}
              onClear={clearFilters}
              isNarrowed={isNarrowed}
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

        {deleteError && (
          <p
            role="alert"
            className="border-danger-line bg-danger-bg text-danger rounded-lg border px-3 py-2 text-[11px]"
          >
            {getErrorMessage(deleteError)}
          </p>
        )}
      </div>

      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4 lg:px-6">
        <MonthRail
          days={days}
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

          {!isLoading && !isError && groups.length === 0 && (
            <div className="bg-card plate-shadow rounded-xl p-8 text-center">
              <h2 className="font-display text-base font-bold">
                {isNarrowed ? m.tape_empty_filtered() : m.tape_empty_title()}
              </h2>
              {!isNarrowed && (
                <p className="text-muted mx-auto mt-2 max-w-sm text-[12px] leading-relaxed">
                  {m.tape_empty_body()}
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
