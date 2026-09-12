import { useCallback, useMemo } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { useHousehold } from '@/contexts/useHousehold'
import { CalendarStrip } from '@/modules/financial/components/CalendarStrip'
import { DaySheet } from '@/modules/financial/components/DaySheet'
import { MonthGrid } from '@/modules/financial/components/MonthGrid'
import { useCalendarMonth } from '@/modules/financial/hooks/useCalendarMonth'
import { useAccounts } from '@/modules/settings/api/accounts'
import { useCategories } from '@/modules/settings/api/categories'
import { useIncomeTypes } from '@/modules/settings/api/incomeTypes'
import { useRoster } from '@/modules/settings/api/members'
import { rimFor } from '@/theme/rims'
import { isoDay } from '@/utils/dates'
import type { RimIndex } from '@/theme/rims'

/** The ceiling both list routes accept, and therefore what a month may hold. */
const PAGE_SIZE = 500

/**
 * The month, as a shape.
 *
 * `/expenses` answers what the household spent and `/income` answers what
 * arrived and what only moved. Neither answers what the month *looked like* —
 * where the weight fell, which days were quiet, whether income landed before
 * or after the spending it had to cover. That is this page's only job, and it
 * is why the page reads and never writes: the two ledgers own every mutation,
 * each with its own confirmation and its own permission gate.
 *
 * Shaped in `docs/superpowers/specs/2026-09-12-calendar-design.md`.
 */
export const CalendarPage = () => {
  const m = useMessages()
  const { locale } = useSettings()
  const { householdId } = useHousehold()
  const {
    month,
    selectedDate,
    selectDate,
    setMonth,
    stepMonth,
    canStepForward,
    calendar,
    expenseTotals,
    incomePage,
    isLoading,
    isError,
    refetch,
  } = useCalendarMonth(householdId)

  // Every catalogue, archived rows included: an archived category still names
  // the entries recorded under it, and a day sheet that printed a dash for one
  // would lose the row's meaning rather than its colour.
  const { data: categories } = useCategories(householdId)
  const { data: accounts } = useAccounts(householdId)
  const { data: incomeTypes } = useIncomeTypes(householdId)
  const { data: users } = useRoster(householdId)

  /**
   * One lookup for every id the day sheet prints. Categories, sources, income
   * types and members share an id space in practice, and four near-identical
   * resolvers on one component is four places for a fallback to differ.
   */
  const nameOf = useCallback(
    (id: string): string =>
      categories?.find((row) => row.id === id)?.name ??
      accounts?.find((row) => row.id === id)?.name ??
      incomeTypes?.find((row) => row.id === id)?.name ??
      users?.find((row) => row.id === id)?.name ??
      '—',
    [categories, accounts, incomeTypes, users],
  )

  // Rims come from the row's stable `order`, never its position in a fetched
  // array — the same rule `/income` follows, so a category is one colour on
  // every screen.
  const rimOf = useCallback(
    (id: string): RimIndex =>
      rimFor(
        categories?.find((row) => row.id === id)?.order ??
          accounts?.find((row) => row.id === id)?.order ??
          0,
      ),
    [categories, accounts],
  )

  const today = isoDay(new Date())
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(month)

  const openDay = useMemo(
    () => calendar.days.find((day) => day.date === selectedDate) ?? null,
    [calendar.days, selectedDate],
  )

  const isEmpty = !isLoading && !isError && calendar.entryCount === 0
  // A page holding fewer rows than its set would draw a month missing days,
  // which is a false statement about the household's month in exactly the way
  // a partial total is. Nothing is drawn from it.
  const isPartial = !isLoading && !isError && !calendar.isComplete

  return (
    <section className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col gap-3 px-4 pt-4 pb-3 lg:px-6">
        <CalendarStrip
          month={month}
          onStepMonth={stepMonth}
          onSelectMonth={setMonth}
          canStepForward={canStepForward}
          expenseTotals={expenseTotals}
          incomePage={incomePage}
          calendar={calendar}
          isLoading={isLoading}
        />
      </div>

      <div className="min-h-0 flex-1 px-4 pb-6 lg:px-6">
        {isError && (
          <div
            role="alert"
            className="border-danger-line bg-danger-bg flex items-start gap-2.5 rounded-xl border p-4"
          >
            <Warn className="text-danger" />
            <div>
              <p className="text-danger text-[12.5px] font-semibold">
                {m.cal_error_title({ month: monthLabel })}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed">
                {m.cal_error_body()}
              </p>
              <button
                type="button"
                onClick={refetch}
                className="bg-danger mt-2.5 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-white"
              >
                {m.tape_retry()}
              </button>
            </div>
          </div>
        )}

        {isPartial && (
          <div
            role="alert"
            className="border-hair bg-card flex items-start gap-2.5 rounded-xl border p-4"
          >
            <Warn className="text-muted" />
            <div>
              <p className="text-[12.5px] font-semibold">
                {m.cal_partial_title({ month: monthLabel })}
              </p>
              <p className="text-muted mt-1 text-[11.5px] leading-relaxed">
                {m.cal_partial_body({
                  n: calendar.entryCount,
                  limit: PAGE_SIZE,
                })}
              </p>
            </div>
          </div>
        )}

        {!isError && !isPartial && (
          <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="bg-card plate-shadow rounded-2xl p-3 sm:p-4">
              {isLoading && (
                <p className="text-muted mb-3 flex items-center gap-2 text-[11.5px] font-medium">
                  <Spinner />
                  {m.cal_loading({ month: monthLabel })}
                </p>
              )}

              <MonthGrid
                month={month}
                calendar={calendar}
                selectedDate={selectedDate}
                today={today}
                onSelect={selectDate}
              />

              {isEmpty && (
                <div className="border-hair mt-3 flex flex-col items-center gap-1.5 rounded-xl border px-6 py-7 text-center">
                  <p className="text-[13px] font-semibold">
                    {m.cal_empty_title({ month: monthLabel })}
                  </p>
                  <p className="text-muted max-w-[34ch] text-[11.5px] leading-relaxed">
                    {m.cal_empty_body()}
                  </p>
                </div>
              )}
            </div>

            <DaySheet
              day={openDay}
              today={today}
              nameOf={nameOf}
              rimOf={rimOf}
            />
          </div>
        )}
      </div>
    </section>
  )
}

const Warn = ({ className }: { className: string }) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={`mt-0.5 shrink-0 ${className}`}
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5m0 3.5v.01" />
  </svg>
)

/** The app's one loading indicator, at the size a line of text wants. */
const Spinner = () => (
  <svg
    className="spinner"
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <circle
      cx="8"
      cy="8"
      r="6.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="30 12"
    />
  </svg>
)
