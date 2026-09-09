import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { IncomePlate } from '@/modules/financial/components/IncomePlate'
import { isOptimisticId } from '@/modules/financial/api/income'
import { formatCurrency } from '@/utils/formatters'
import { fromIsoDay } from '@/utils/dates'
import type { RimIndex } from '@/theme/rims'
import type { DayIncomeGroup } from '@/modules/financial/types/ledger'
import type { Income } from '@/types/income'

interface Props {
  groups: DayIncomeGroup[]
  rimOf: (sourceId: string) => RimIndex
  nameOfSource: (sourceId: string) => string
  nameOfUser: (userId: string) => string
  openId: string | null
  onToggle: (id: string) => void
  canManage: boolean
  onEdit?: (income: Income) => void
  onDelete?: (income: Income) => void
}

/**
 * One continuous statement, newest first, on day shelves — the same device the
 * expense tape uses, and for the same reason.
 *
 * An earlier version put the day in a column inside each row, printed once per
 * day and blank on repeats, on the argument that eight headers over eight rows
 * is more chrome than content. In practice it read as `4 FRI` with no month,
 * gave the eye nothing to anchor on, and left the second entry of a day sitting
 * against an empty cell that looked like a bug rather than a continuation. Two
 * ledgers in one product should also group time the same way, and the page has
 * the vertical room. Shelves.
 */
export const IncomeStatement = ({
  groups,
  rimOf,
  nameOfSource,
  nameOfUser,
  openId,
  onToggle,
  canManage,
  onEdit,
  onDelete,
}: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const currency = useCurrency()

  /** A day with one entry on it does not have "1 entries" on it. */
  const countLabel = (n: number) =>
    n === 1 ? m.tape_entries_one() : m.tape_entries_short({ n })

  const money = (value: number) => formatCurrency(value, currency, locale)

  /**
   * What the day did, in the terms the strip already established.
   *
   * A bare figure would be the ambiguity this page has to avoid: on a day that
   * only moved money it would read as earnings, and on a mixed day no single
   * figure is true at all. So the two are named whenever both are present, and
   * `moved` is named even alone.
   */
  const dayFigures = (group: DayIncomeGroup): string[] => {
    const parts: string[] = []
    if (group.inflow > 0 && group.moved > 0) {
      parts.push(m.inc_day_in({ amount: `+${money(group.inflow)}` }))
      parts.push(m.inc_day_moved({ amount: money(group.moved) }))
    } else if (group.inflow > 0) {
      // The `+` already says which it is, so the word would be noise.
      parts.push(`+${money(group.inflow)}`)
    } else if (group.moved > 0) {
      parts.push(m.inc_day_moved({ amount: money(group.moved) }))
    }
    return parts
  }

  return (
    <div className="flex flex-col">
      {groups.map((group) => {
        const date = fromIsoDay(group.date)
        const figures = dayFigures(group)
        return (
          <section
            key={group.date}
            aria-label={new Intl.DateTimeFormat(locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).format(date)}
            className="scroll-mt-2 pt-6 first:pt-1"
          >
            {/* A day is a group and the spacing says so: 24px above the header
                against 6px between its rows. Sticky, because a day with a
                dozen entries otherwise loses its own date off the top. */}
            <header className="bg-ground sticky top-0 z-10 flex items-center gap-3 pb-2">
              <h3 className="font-display text-[11px] font-bold tracking-[0.12em] uppercase">
                {new Intl.DateTimeFormat(locale, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'long',
                }).format(date)}
              </h3>
              <span aria-hidden="true" className="bg-hair h-px flex-1" />
              <span className="tnum text-[12px] whitespace-nowrap">
                {figures.map((figure, index) => (
                  <span key={figure}>
                    {index > 0 && (
                      <span className="text-muted font-medium">{' · '}</span>
                    )}
                    <span
                      className={
                        // Only the arrival is emphasised. A day's transfers are
                        // context, not a result.
                        index === 0 && group.inflow > 0
                          ? 'text-rim-1 font-semibold'
                          : 'text-muted font-medium'
                      }
                    >
                      {figure}
                    </span>
                  </span>
                ))}
                <span className="text-muted font-medium">
                  {' · '}
                  {countLabel(group.income.length)}
                </span>
              </span>
            </header>

            <ul className="flex flex-col gap-1.5">
              {group.income.map((income) => (
                <IncomePlate
                  key={income.id}
                  income={income}
                  rim={rimOf(income.toSourceId)}
                  fromName={
                    income.fromSourceId === null
                      ? null
                      : nameOfSource(income.fromSourceId)
                  }
                  toName={nameOfSource(income.toSourceId)}
                  recorderName={nameOfUser(income.createdByUserId ?? '')}
                  isOpen={openId === income.id}
                  onToggle={onToggle}
                  currency={currency}
                  // A row the server has not acknowledged has no id worth
                  // acting on: editing it would address a record that does
                  // not exist.
                  canManage={canManage && !isOptimisticId(income.id)}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
