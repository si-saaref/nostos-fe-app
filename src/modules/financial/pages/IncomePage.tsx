import { useCallback, useMemo, useState } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { useHousehold } from '@/contexts/useHousehold'
import { useSettings } from '@/contexts/useSettings'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DismissablePanel } from '@/components/DismissablePanel'
import { useDeleteIncome, useIncome } from '@/modules/financial/api/income'
import { usePositions } from '@/modules/financial/api/positions'
import { useIncomeFilters } from '@/modules/financial/hooks/useIncomeFilters'
import { incomeMonthFigures } from '@/modules/financial/lib/incomeFigures'
import { groupPositionsByKind } from '@/modules/financial/lib/positionGroups'
import { IncomeFilter } from '@/modules/financial/components/IncomeFilter'
import { InflowStrip } from '@/modules/financial/components/InflowStrip'
import { PositionCard } from '@/modules/financial/components/PositionCard'
import { IncomeForm } from '@/modules/financial/components/IncomeForm'
import { IncomeStatement } from '@/modules/financial/components/IncomeStatement'
import { useAccounts } from '@/modules/settings/api/accounts'
import { useIncomeTypes } from '@/modules/settings/api/incomeTypes'
import { useRoster } from '@/modules/settings/api/members'
import { canManageExpenses } from '@/utils/permissions'
import { getErrorMessage } from '@/utils/errors'
import { rimFor } from '@/theme/rims'
import { monthRange } from '@/utils/dates'
import { averageMoney, sumMoney } from '@/utils/money'
import type { Paginated } from '@/types/api'
import type { DayIncomeGroup } from '@/modules/financial/types/ledger'
import type { Income } from '@/types/income'

/** One reading measure for every band, matching the expenses page. */
const MEASURE = 'mx-auto w-full max-w-[1320px]'

/**
 * The income surface: one position card that states, one statement that lists.
 *
 * The page runs on two clocks and its job is to keep them apart. The strip and
 * the statement are scoped to the month in the stepper; the position card is
 * cumulative to a day and carries its own stamp. Stepping back to March moves
 * the flows and the movement notes, and leaves what the household holds today
 * exactly where it was — which only reads as correct because each figure says
 * which clock it is on.
 *
 * Shaped in `docs/SURFACE-INCOME.md`.
 */
export const IncomePage = () => {
  const m = useMessages()
  const { householdId, role } = useHousehold()
  const { locale } = useSettings()
  const {
    filters,
    updateFilters,
    month,
    setMonth,
    stepMonth,
    canStepForward,
    previousMonth,
    asOf,
    data,
    isLoading,
    isError,
    refetch,
  } = useIncomeFilters(householdId)

  const positions = usePositions(householdId, {
    asOf,
    // `useIncomeFilters` always resolves a month, so the fallback is
    // unreachable — but the route rejects a missing `from` outright, so it
    // must not depend on that being true.
    from: filters.dateFrom ?? monthRange(month).from,
  })
  // Every source, not only the live ones: an archived source can still hold
  // money, and the position card has to be able to name what it renders.
  const { data: accounts } = useAccounts(householdId)
  // Every type, not only the live ones: an archived type still names the
  // entries recorded under it. Same query as the form's picker, so the page
  // and the panel share one request.
  const { data: incomeTypes } = useIncomeTypes(householdId)
  const { data: users } = useRoster(householdId)
  const { mutate: deleteIncome, error: deleteError } =
    useDeleteIncome(householdId)

  const [openId, setOpenId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [toDelete, setToDelete] = useState<Income | null>(null)
  // Separate from `showForm`, so opening an edit never silently discards a
  // half-typed new entry.
  const [toEdit, setToEdit] = useState<Income | null>(null)

  const isNarrowed = Boolean(filters.typeId)
  const items = useMemo(() => {
    const rows = data?.items ?? []
    return filters.typeId
      ? rows.filter((row) => row.typeId === filters.typeId)
      : rows
  }, [data, filters.typeId])

  /**
   * The page every figure on this screen is counted from.
   *
   * Unnarrowed it is simply the server's, aggregates and all. Narrowed by
   * type it cannot be: the route takes no `type_id`, so `meta.totals` still
   * describes the whole month while the statement below shows one type, and
   * a strip disagreeing with the list under it is the failure this page is
   * arranged to prevent. So the aggregates are recomputed from the rows —
   * exact only while the page holds every row of the month, and `undefined`
   * rather than a partial sum when it does not.
   *
   * `sum` counts external arrivals only, because that is what `totals.sum`
   * means: transfers cancel themselves out of net inflow.
   */
  const scopedPage = useMemo<Paginated<Income> | undefined>(() => {
    if (!data) return undefined
    if (!filters.typeId) return data
    if (data.items.length < data.pagination.total) return undefined
    const external = items.filter((row) => row.fromSourceId === null)
    const sum = sumMoney(external.map((row) => row.amount))
    return {
      items,
      pagination: { ...data.pagination, total: items.length },
      totals: {
        sum,
        count: items.length,
        average: averageMoney(sum, items.length),
      },
    }
  }, [data, items, filters.typeId])

  /**
   * Day groups, newest first, each carrying its arrival and its movement
   * apart. A single gross figure would report money the household never
   * gained on any day that mixed a salary with a withdrawal.
   */
  const groups = useMemo<DayIncomeGroup[]>(() => {
    const byDay = new Map<string, Income[]>()
    items.forEach((row) => {
      const bucket = byDay.get(row.date)
      if (bucket) bucket.push(row)
      else byDay.set(row.date, [row])
    })
    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, rows]) => ({
        date,
        income: rows,
        inflow: sumMoney(
          rows.filter((row) => row.fromSourceId === null).map((r) => r.amount),
        ),
        moved: sumMoney(
          rows.filter((row) => row.fromSourceId !== null).map((r) => r.amount),
        ),
      }))
  }, [items])

  const figures = useMemo(() => incomeMonthFigures(scopedPage), [scopedPage])

  const positionGroups = useMemo(
    () => groupPositionsByKind(positions.data?.items ?? [], accounts ?? []),
    [positions.data, accounts],
  )

  // Stable identities: the statement memoises each plate, and a lookup rebuilt
  // every render would re-render every row on every disclosure toggle.
  const rimOf = useCallback(
    (sourceId: string) =>
      rimFor(accounts?.find((account) => account.id === sourceId)?.order ?? 0),
    [accounts],
  )
  const nameOfSource = useCallback(
    (sourceId: string) =>
      accounts?.find((account) => account.id === sourceId)?.name ?? '—',
    [accounts],
  )
  const nameOfType = useCallback(
    (typeId: string) =>
      incomeTypes?.find((type) => type.id === typeId)?.name ?? '—',
    [incomeTypes],
  )
  const nameOfUser = useCallback(
    (userId: string) => users?.find((user) => user.id === userId)?.name ?? '—',
    [users],
  )
  const toggleOpen = useCallback(
    (id: string) => setOpenId((current) => (current === id ? null : id)),
    [],
  )
  const requestEdit = useCallback((income: Income) => {
    setToEdit(income)
    // One form on the page at a time. A blank "record" panel stacked above a
    // populated "edit" panel offers two submits for two different acts.
    setShowForm(false)
    // The disclosure and the edit panel would otherwise show the same row
    // twice, in two places, with two sets of values.
    setOpenId(null)
  }, [])
  const requestRecord = useCallback(() => {
    setToEdit(null)
    setShowForm(true)
  }, [])
  const requestDelete = useCallback((income: Income) => setToDelete(income), [])

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(month)
  const previousLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(month.getFullYear(), month.getMonth() - 1, 1))

  const canManage = canManageExpenses(role)
  /** A form is on screen, so nothing else may offer to open one. */
  const isRecording = showForm || toEdit !== null
  const activeType = incomeTypes?.find((type) => type.id === filters.typeId)
  const entryCount = scopedPage?.pagination.total ?? items.length
  const scopeLine = activeType
    ? entryCount === 1
      ? m.inc_scope_filtered_one({
          month: monthLabel,
          type: activeType.name,
        })
      : m.inc_scope_filtered({
          month: monthLabel,
          type: activeType.name,
          n: entryCount,
        })
    : entryCount === 0
      ? m.inc_scope({ month: monthLabel })
      : entryCount === 1
        ? m.inc_scope_count_one({ month: monthLabel })
        : m.inc_scope_count({ month: monthLabel, n: entryCount })

  return (
    <section className="flex h-full flex-col">
      {/* Pinned. The month figures and the position never scroll away from
          the statement they describe — the two questions this page answers are
          co-equal, and a position you have to scroll back up to find is not.
          It is also what the sticky day shelves stick beneath. */}
      <div
        className={`${MEASURE} flex shrink-0 flex-col gap-3 px-4 pt-4 pb-3 lg:px-6`}
      >
        <InflowStrip
          householdId={householdId}
          month={month}
          previousMonth={previousMonth}
          onStepMonth={stepMonth}
          onSelectMonth={setMonth}
          canStepForward={canStepForward}
          totals={scopedPage?.totals}
          summary={data?.summary}
          opening={positions.data?.totals.opening}
          hasOpening={positions.isSuccess}
          figures={figures}
        />

        <PositionCard
          groups={positionGroups}
          total={positions.data?.totals.balance ?? 0}
          asOf={asOf}
          isLoading={positions.isLoading}
          isUnavailable={positions.isError}
        />

        {/* The same control band the expense ledger has: what narrows the
            list on the left, what it currently shows beside it, and the one
            way to add to it on the right. */}
        <div className="flex flex-wrap items-center gap-2">
          <IncomeFilter
            householdId={householdId}
            filters={filters}
            onChange={updateFilters}
          />
          <p className="text-muted text-[11px] font-semibold">{scopeLine}</p>
          <span className="flex-1" />
          {/* Gone while the form is open. A "+ Record income" button whose
              only effect is to close the record-income form is a lie, and it
              also put a third control named "Catat" on the page — the form's
              own submit is the way to record once the form is there. */}
          {!isRecording && (
            <button
              type="button"
              onClick={requestRecord}
              className="bg-accent text-accent-ink hidden shrink-0 rounded-lg px-4 py-2 text-[12px] font-semibold lg:block"
            >
              + {m.action_record_income()}
            </button>
          )}
        </div>

        {showForm && (
          <DismissablePanel
            onDismiss={() => setShowForm(false)}
            className="bg-card lift-shadow rounded-xl p-4"
          >
            <IncomeForm
              onSuccess={() => setShowForm(false)}
              onCancel={() => setShowForm(false)}
            />
          </DismissablePanel>
        )}

        {toEdit && (
          <DismissablePanel
            onDismiss={() => setToEdit(null)}
            className="bg-card lift-shadow rounded-xl p-4"
          >
            <h2 className="font-display mb-3 text-[12.5px] font-bold">
              {m.inc_form_edit_title({ name: toEdit.name })}
            </h2>
            {/* Keyed on the row: hitting Edit on a second plate while one is
                open must reset the fields, not keep the first row's values. */}
            <IncomeForm
              key={toEdit.id}
              income={toEdit}
              onSuccess={() => setToEdit(null)}
              onCancel={() => setToEdit(null)}
            />
          </DismissablePanel>
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

      <div
        className={`${MEASURE} flex min-h-0 flex-1 flex-col px-4 pb-4 lg:px-6`}
      >
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1 pb-24 lg:pb-2">
          {isLoading && (
            <p
              role="status"
              aria-live="polite"
              className="text-muted py-8 text-sm"
            >
              {m.inc_loading()}
            </p>
          )}

          {isError && (
            <div role="alert" className="bg-card plate-shadow rounded-xl p-6">
              <p className="text-sm font-semibold">{m.inc_error()}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="bg-accent text-accent-ink mt-3 rounded-lg px-3 py-2 text-[12px] font-semibold"
              >
                {m.tape_retry()}
              </button>
            </div>
          )}

          {/* Month-scoped, and pointing backwards. On the 1st of a month the
            useful next click is not "record something" — the household may
            have nothing to record yet — it is the month this position came
            from. "No income recorded" would also be a claim about the
            household, when an empty October is only a fact about October. */}
          {!isLoading && !isError && groups.length === 0 && isNarrowed && (
            <div className="bg-card plate-shadow flex h-full min-h-[18rem] flex-col items-center justify-center rounded-xl p-8 text-center">
              <h2 className="font-display text-base font-bold">
                {m.inc_empty_filtered({ month: monthLabel })}
              </h2>
              <button
                type="button"
                onClick={() => updateFilters({ typeId: undefined, page: 1 })}
                className="border-hair text-ink mt-4 rounded-lg border px-4 py-2 text-[11.5px] font-semibold"
              >
                {m.count_scope_all({ what: m.count_types() })}
              </button>
            </div>
          )}

          {!isLoading && !isError && groups.length === 0 && !isNarrowed && (
            <EmptyMonth
              householdId={householdId}
              monthLabel={monthLabel}
              previousLabel={previousLabel}
              previousMonth={previousMonth}
              servedPreviousCount={data?.summary?.previous?.count}
              onBack={() => stepMonth(-1)}
            />
          )}

          {!isLoading && !isError && groups.length > 0 && (
            <IncomeStatement
              groups={groups}
              rimOf={rimOf}
              nameOfSource={nameOfSource}
              nameOfType={nameOfType}
              nameOfUser={nameOfUser}
              openId={openId}
              onToggle={toggleOpen}
              canManage={canManage}
              onEdit={requestEdit}
              onDelete={requestDelete}
            />
          )}
        </div>
      </div>

      {!isRecording && (
        <button
          type="button"
          onClick={requestRecord}
          className="bg-accent text-accent-ink fixed right-4 bottom-20 z-30 flex h-12 items-center gap-2 rounded-xl px-5 text-[13px] font-semibold shadow-lg lg:hidden"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            +
          </span>
          {m.action_record()}
        </button>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={m.income_delete_title({ name: toDelete?.name ?? '' })}
        body={m.income_delete_body()}
        confirmLabel={m.income_delete_confirm()}
        destructive
        onConfirm={() => {
          if (toDelete) deleteIncome(toDelete.id)
          setToDelete(null)
          setOpenId(null)
        }}
      />
    </section>
  )
}

/**
 * The empty month, which is also the moment the whole two-clock design has to
 * survive: no flows at all, and a position above that is fully populated. So
 * the copy says exactly that, rather than letting the reader wonder whether
 * the balance is stale.
 *
 * The way out points *backwards*. On the 1st of a month the useful next click
 * is rarely "record something" — the household may genuinely have nothing yet —
 * it is the month this position was carried from.
 */
const EmptyMonth = ({
  householdId,
  monthLabel,
  previousLabel,
  previousMonth,
  servedPreviousCount,
  onBack,
}: {
  householdId: string
  monthLabel: string
  previousLabel: string
  previousMonth: { from: string; to: string }
  /** From `meta.summary.previous`, when the deployment sends one. */
  servedPreviousCount?: number
  onBack: () => void
}) => {
  const m = useMessages()
  // The same key the strip already asked for, so while the strip still has to
  // ask this costs no request: one row, for the count in `meta`. Once the
  // summary carries the previous month, neither of them asks at all.
  const previous = useIncome(
    householdId,
    {
      dateFrom: previousMonth.from,
      dateTo: previousMonth.to,
      page: 1,
      limit: 1,
    },
    { enabled: servedPreviousCount === undefined },
  )
  const count = servedPreviousCount ?? previous.data?.totals?.count

  return (
    <div className="bg-card plate-shadow flex h-full min-h-[18rem] flex-col items-center justify-center rounded-xl p-8 text-center">
      <h2 className="font-display text-base font-bold">
        {m.inc_empty_title({ month: monthLabel })}
      </h2>
      <p className="text-muted mx-auto mt-2 max-w-sm text-[12px] leading-relaxed">
        {m.inc_empty_body()}
      </p>
      {/* Offered only when the previous month has something in it. A household
          recording its very first entry has no "back" worth taking, and a
          button reading "← August had 0 entries" is a dead end wearing a
          label. */}
      {count !== undefined && count > 0 ? (
        <button
          type="button"
          onClick={onBack}
          className="border-hair text-ink mt-4 rounded-lg border px-4 py-2 text-[11.5px] font-semibold"
        >
          {count === 1
            ? m.inc_empty_back_one({ month: previousLabel })
            : m.inc_empty_back({ month: previousLabel, n: count })}
        </button>
      ) : (
        <p className="text-muted mt-3 text-[11.5px] font-semibold">
          {m.inc_empty_first()}
        </p>
      )}
    </div>
  )
}
