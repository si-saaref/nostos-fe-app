import { usePhone } from '@/hooks/usePhone'
import { railCumulative, pageForDay } from '@/modules/financial/lib/railFigures'
import { compactMemberLabels } from '@/modules/financial/lib/memberLabel'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { LedgerEditor } from '@/modules/financial/components/LedgerEditor'
import { useHousehold } from '@/contexts/useHousehold'
import { useSettings } from '@/contexts/useSettings'
import { useMessages } from '@/i18n/useMessages'
import { useDeleteExpense } from '@/modules/financial/api/expenses'
import { CountStrip } from '@/modules/financial/components/CountStrip'
import { ExpenseFilter } from '@/modules/financial/components/ExpenseFilter'
import { ExpenseForm } from '@/modules/financial/components/ExpenseForm'
import { ExpenseTape } from '@/modules/financial/components/ExpenseTape'
import { MonthRail } from '@/modules/financial/components/MonthRail'
import { useExpenseFilters } from '@/modules/financial/hooks/useExpenseFilters'
import { useItemBaselines } from '@/modules/financial/hooks/useItemBaselines'
import type {
  DayGroup,
  DayTotal,
  ScopeChip,
  TopSlice,
} from '@/modules/financial/types/ledger'
import { useAccounts, useActiveAccounts } from '@/modules/settings/api/accounts'
import {
  useCategories,
  useActiveCategories,
} from '@/modules/settings/api/categories'
import { useRoster } from '@/modules/settings/api/members'
import { rimFor } from '@/theme/rims'
import type { Expense } from '@/types/expense'
import { getErrorMessage } from '@/utils/errors'
import { sumMoney, sumMoneyText } from '@/utils/money'
import { canManageExpenses } from '@/utils/permissions'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export const ExpensesPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
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
  const { data: allCategories } = useCategories(householdId)
  const { data: allAccounts } = useAccounts(householdId)
  const { data: users } = useRoster(householdId)
  const { judge, baselineFor, recentFor } = useItemBaselines(householdId)
  const { mutate: deleteExpense, error: deleteError } =
    useDeleteExpense(householdId)

  const editorReturnFocus = useRef<HTMLElement | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(() =>
    Boolean(
      (location.state as { recordExpense?: boolean } | null)?.recordExpense,
    ),
  )
  useEffect(() => {
    if (!(location.state as { recordExpense?: boolean } | null)?.recordExpense)
      return
    navigate(location.pathname + location.search, {
      replace: true,
      state: null,
    })
  }, [location, navigate])
  const [scrolledDate, setScrolledDate] = useState<string | undefined>()
  const [atEnd, setAtEnd] = useState(true)
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null)
  // The row being corrected. Separate state from `showForm` so opening an edit
  // never silently discards a half-typed new entry.
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null)
  const dayNodes = useRef(new Map<string, HTMLElement>())
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLElement>(null)
  const pendingJump = useRef<string | null>(null)
  const phone = usePhone()

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
        totalText: sumMoneyText(rows.map((row) => row.value)),
      }))
  }, [expenses])

  const days = useMemo<DayTotal[]>(() => {
    if (data?.summary?.daily)
      return [...data.summary.daily].reverse().map((day) => ({
        date: day.date,
        total: day.sum,
        totalText: day.sumText,
        count: day.count,
      }))
    if (expenses.length < (data?.pagination.total ?? 0)) return []
    return groups.map((group) => ({
      date: group.date,
      total: group.total,
      totalText: group.totalText,
      count: group.expenses.length,
    }))
  }, [data, expenses.length, groups])
  const visibleDays = groups.map((group) => group.date)

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
    ? visibleDays[visibleDays.length - 1]
    : visibleDays.includes(scrolledDate ?? '')
      ? scrolledDate
      : visibleDays[0]

  const cumulativeText = railCumulative(data?.summary?.daily, activeDate)
  const cumulative =
    cumulativeText === undefined ? undefined : Number(cumulativeText)

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
    const root = phone ? pageRef.current : scrollRef.current
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
  }, [groups, phone])

  const jumpTo = (date: string) => {
    const node = dayNodes.current.get(date)
    if (node) {
      setScrolledDate(date)
      setAtEnd(false)
      node.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (data?.summary?.daily) {
      pendingJump.current = date
      updateFilters({
        page: pageForDay(data.summary.daily, date, filters.limit),
        sortBy: 'datePaid',
        sortOrder: 'desc',
      })
    }
  }
  useEffect(() => {
    const date = pendingJump.current
    const node = date && dayNodes.current.get(date)
    if (node) {
      pendingJump.current = null
      setScrolledDate(date!)
      setAtEnd(false)
      node.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [groups])

  // Stable identities: the tape memoises each plate, and a lookup rebuilt every
  // render would re-render all 200 of them on every disclosure toggle.
  const rimOf = useCallback(
    (typeId: string) =>
      rimFor(
        allCategories?.find((category) => category.id === typeId)?.order ?? 0,
      ),
    [allCategories],
  )
  const nameOfType = useCallback(
    (typeId: string) =>
      allCategories?.find((category) => category.id === typeId)?.name ?? '—',
    [allCategories],
  )
  const nameOfSource = useCallback(
    (sourceId: string) =>
      allAccounts?.find((account) => account.id === sourceId)?.name ?? '—',
    [allAccounts],
  )
  const memberLabels = useMemo(() => compactMemberLabels(users ?? []), [users])
  const nameOfUser = useCallback(
    (userId: string) => memberLabels.get(userId) ?? '—',
    [memberLabels],
  )
  const toggleOpen = useCallback(
    (id: string) => setOpenId((current) => (current === id ? null : id)),
    [],
  )
  const requestEdit = useCallback((expense: Expense) => {
    editorReturnFocus.current =
      document.activeElement
        ?.closest('article')
        ?.querySelector<HTMLElement>('button[aria-expanded]') ?? null
    setExpenseToEdit(expense)
    // One form on the page at a time. A blank "record" panel stacked above a
    // populated "edit" panel offers two submits for two different acts and
    // gives no clue which one Enter belongs to.
    setShowForm(false)
    // The plate's disclosure and the edit panel would otherwise show the same
    // row twice, in two places, with two sets of values.
    setOpenId(null)
  }, [])
  const requestRecord = useCallback(() => {
    editorReturnFocus.current = document.activeElement as HTMLElement
    setExpenseToEdit(null)
    setShowForm(true)
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
  /** A form is on screen, so nothing else may offer to open one. */
  const isRecording = showForm || expenseToEdit !== null
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
    if (total <= 0) return null

    const kind: TopSlice['kind'] = filters.typeId ? 'member' : 'category'
    const nameOf = kind === 'member' ? nameOfUser : nameOfType
    const share = (value: number) => Math.round((value / total) * 100)

    // Ranked by the server when it can. `meta.summary.breakdown` is computed
    // over the whole filtered set, so it is true on page four as well — which
    // is what retires the "only while we hold every row" guard below.
    const served =
      kind === 'member'
        ? data?.summary?.breakdown?.byMember
        : data?.summary?.breakdown?.byType
    const ranked: Array<[string, number, string?]> = served
      ? served.map((entry) => [entry.id, entry.sum, entry.sumText])
      : (() => {
          // Summed from the rows on hand, which is honest only while the page
          // holds all of them.
          if (expenses.length < (data?.pagination?.total ?? expenses.length)) {
            return []
          }
          const byKey = new Map<string, number[]>()
          expenses.forEach((expense) => {
            const key =
              kind === 'member' ? expense.paidByUserId : expense.typeId
            const bucket = byKey.get(key) ?? []
            bucket.push(expense.value)
            byKey.set(key, bucket)
          })
          return [...byKey.entries()]
            .map(([id, values]): [string, number, string] => [
              id,
              sumMoney(values),
              sumMoneyText(values),
            ])
            .sort((a, b) => b[1] - a[1])
        })()

    const top = ranked[0]
    if (!top) return null
    const second = ranked[1]

    return {
      kind,
      name: nameOf(top[0]),
      amount: sumMoney([top[1]]),
      amountText: top[2],
      pct: share(top[1]),
      runnerUp: second
        ? { name: nameOf(second[0]), pct: share(second[1]) }
        : undefined,
    }
  }, [expenses, data, filters.typeId, nameOfType, nameOfUser])

  return (
    <section
      ref={pageRef}
      className="flex h-full min-h-0 flex-col overflow-y-auto lg:overflow-hidden"
    >
      {/* Pinned: the count and the filters never scroll away from the ledger
          they describe, because a total you cannot see cannot be trusted. */}
      <div className="flex shrink-0 flex-col gap-3 px-4 pt-4 pb-3 lg:px-6">
        <CountStrip
          householdId={householdId}
          filters={filters}
          totals={data?.totals}
          summary={data?.summary}
          listLoaded={data !== undefined}
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
            onClick={requestRecord}
            disabled={isRecording}
            className="bg-accent text-accent-ink hidden rounded-lg px-4 py-2 text-[12px] font-semibold lg:block"
          >
            + {m.action_record_long()}
          </button>
        </div>

        <LedgerEditor
          returnFocusRef={editorReturnFocus}
          open={isRecording}
          title={
            expenseToEdit
              ? m.expense_edit_title({ name: expenseToEdit.name })
              : m.action_record_long()
          }
          onClose={() => {
            setShowForm(false)
            setExpenseToEdit(null)
          }}
        >
          <ExpenseForm
            key={expenseToEdit?.id ?? 'create'}
            expense={expenseToEdit ?? undefined}
            onSuccess={() => {
              setShowForm(false)
              setExpenseToEdit(null)
            }}
            onCancel={() => {
              setShowForm(false)
              setExpenseToEdit(null)
            }}
          />
        </LedgerEditor>

        {deleteError && (
          <p
            role="alert"
            className="border-danger-line bg-danger-bg text-danger rounded-lg border px-3 py-2 text-[11px]"
          >
            {getErrorMessage(deleteError)}
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-4 px-4 pb-24 lg:min-h-0 lg:flex-1 lg:shrink lg:px-6 lg:pb-4">
        <MonthRail
          days={days}
          rangeFrom={filters.dateFrom}
          rangeTo={filters.dateTo}
          activeDate={activeDate}
          onJump={jumpTo}
          cumulative={cumulative}
          cumulativeText={cumulativeText}
          monthTotal={data?.totals?.sum ?? 0}
        />

        <div
          ref={scrollRef}
          className="min-w-0 flex-1 pr-1 lg:min-h-0 lg:overflow-y-auto lg:pb-2"
        >
          {/* {isLoading && <Loading full label={m.tape_loading()} />} */}

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
          {/* Full height, not a shallow card with a screen of nothing under
              it: an empty month is the whole answer, so it occupies the whole
              space the tape would have. */}
          {!isLoading && !isError && groups.length === 0 && (
            <div className="bg-card plate-shadow flex h-full min-h-[18rem] flex-col items-center justify-center rounded-xl p-8 text-center">
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
              categoryKeyOf={(id) =>
                allCategories?.find((type) => type.id === id)?.systemKey ?? null
              }
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
            cumulativeText={cumulativeText}
            monthTotal={data?.totals?.sum ?? 0}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={requestRecord}
        disabled={isRecording}
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
