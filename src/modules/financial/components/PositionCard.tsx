import { Link } from 'react-router-dom'
import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { SETTINGS_ANCHORS, settingsHref } from '@/modules/settings/anchors'
import { RIM_CLASS } from '@/theme/rims'
import { formatCurrency } from '@/utils/formatters'
import { fromIsoDay } from '@/utils/dates'
import type {
  PositionGroup,
  PositionSource,
} from '@/modules/financial/lib/positionGroups'
import type { AccountKind } from '@/types/catalog'

interface Props {
  groups: PositionGroup[]
  /** Household total. Passed rather than re-summed, so it cannot disagree. */
  total: number
  /** The day every figure here is true as of. */
  asOf: string
  isLoading: boolean
  /** The endpoint is not built yet, so this is a designed state (§7). */
  isUnavailable: boolean
}

/**
 * What the household holds, per source, grouped by kind.
 *
 * It **states**; it does not filter. A card that narrowed the statement below
 * would make every entry appear twice across the page — once under the source
 * it left and once under the source it reached — and would make "8 entries"
 * need a footnote. So this is a read, and the statement stays whole.
 *
 * Its date stamp is not decoration. Every figure on it is cumulative to a day,
 * while everything else on the page is scoped to a month; stepping the month
 * changes the movement notes and leaves the balances alone, which only reads
 * correctly because the two clocks are labelled.
 */
export const PositionCard = ({
  groups,
  total,
  asOf,
  isLoading,
  isUnavailable,
}: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const currency = useCurrency()
  const money = (value: number) => formatCurrency(value, currency, locale)

  const kindLabel: Record<AccountKind, string> = {
    bank: m.acc_kind_bank(),
    ewallet: m.acc_kind_ewallet(),
    cash: m.acc_kind_cash(),
  }

  const stamp = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fromIsoDay(asOf))

  if (isUnavailable) {
    return (
      <section
        aria-label={m.pos_title()}
        className="well-shadow bg-chip rounded-xl px-4 py-3.5"
      >
        <h2 className="font-display text-[10px] font-bold tracking-[0.13em] uppercase">
          {m.pos_title()}
        </h2>
        {/* No figure, no skeleton pretending one is coming, and no zero. A
            zero here is a claim about the household's money that nobody has
            checked. */}
        <p className="text-muted mt-1.5 max-w-prose text-[11.5px] leading-relaxed">
          <span className="text-ink font-semibold">{m.pos_down_title()}</span>{' '}
          {m.pos_down_body()}
        </p>
      </section>
    )
  }

  if (isLoading) {
    return (
      <section
        aria-label={m.pos_title()}
        className="bg-card plate-shadow rounded-xl px-4 py-3.5"
      >
        <p
          role="status"
          aria-live="polite"
          className="text-muted text-[11.5px]"
        >
          {m.state_loading()}
        </p>
      </section>
    )
  }

  if (groups.length === 0) {
    return (
      <section
        aria-label={m.pos_title()}
        className="bg-card plate-shadow rounded-xl px-4 py-3.5"
      >
        <p className="text-muted text-[11.5px] leading-relaxed">
          {m.pos_empty()}{' '}
          <Link
            to={settingsHref(SETTINGS_ANCHORS.accounts)}
            className="text-accent font-semibold underline underline-offset-2"
          >
            {m.pos_manage()}
          </Link>
        </p>
      </section>
    )
  }

  return (
    <section
      aria-label={m.pos_title()}
      className="bg-card plate-shadow overflow-hidden rounded-xl"
    >
      <header className="border-hair flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b px-4 py-2.5">
        <h2 className="font-display text-[10px] font-bold tracking-[0.13em] uppercase">
          {m.pos_title()}
        </h2>
        <p className="text-muted text-[9.5px] font-bold">
          {m.pos_as_of({ date: stamp })}
        </p>
        <p className="text-muted ml-auto text-[11px] font-semibold whitespace-nowrap">
          {m.pos_holds()}
          <span className="font-display tnum text-ink ml-1.5 text-base font-bold">
            {money(total)}
          </span>
        </p>
      </header>

      {/* One column per kind on a wide screen, stacked on a narrow one. Kinds
          rather than sources, because three banks in a row of six equal plates
          answers "how much is in BNI" and never answers "how much is in banks
          at all" — which is the question the subtotal exists for. */}
      <div className="bg-hair grid gap-px sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.kind} className="bg-card min-w-0 px-3.5 py-2.5">
            <div className="mb-1.5 flex items-baseline gap-2">
              <h3 className="text-muted text-[8.5px] font-bold tracking-[0.11em] uppercase">
                {m.pos_kind_count({
                  kind: kindLabel[group.kind],
                  n: group.sources.length,
                })}
              </h3>
              {/* A red minus sign at 11px is the whole distinction between
                  a kind that is up and a kind that is short, so the subtotal
                  says which in a word too — colour never carries it alone. */}
              <p
                className={`ml-auto flex items-baseline gap-1 text-[11px] font-bold ${
                  group.balance < 0 ? 'text-danger' : ''
                }`}
              >
                {group.balance < 0 && (
                  <span className="text-[8.5px] font-bold tracking-[0.09em] uppercase">
                    {m.pos_short()}
                  </span>
                )}
                <span className="tnum">{money(group.balance)}</span>
              </p>
            </div>
            <ul className="flex flex-col gap-0.5">
              {group.sources.map((source) => (
                <SourceRow key={source.id} source={source} money={money} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Zero and negative are legal (PRD §Risks) and therefore designed. Each says
 * what it is in words as well as in colour: a red figure alone reads as a bug,
 * and colour alone would fail 1.4.1 outright.
 */
const SourceRow = ({
  source,
  money,
}: {
  source: PositionSource
  money: (value: number) => string
}) => {
  const m = useMessages()
  const isShort = source.balance < 0
  const isEmpty = source.balance === 0

  const movement =
    source.movement > 0
      ? m.pos_movement_up({ amount: money(source.movement) })
      : source.movement < 0
        ? m.pos_movement_down({ amount: money(Math.abs(source.movement)) })
        : m.pos_movement_flat()

  const state = isShort ? m.pos_negative() : isEmpty ? m.pos_zero() : null

  return (
    <li className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-x-2 py-0.5">
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-[3px] ${RIM_CLASS[source.rim]}`}
      />
      <span className="truncate text-[11.5px] font-semibold">
        {source.name}
      </span>
      <span
        className={`tnum text-[11.5px] font-bold whitespace-nowrap ${
          isShort ? 'text-danger' : isEmpty ? 'text-muted' : ''
        }`}
      >
        {money(source.balance)}
      </span>
      <span
        className={`col-start-2 col-end-4 -mt-0.5 text-[9px] font-bold ${
          isShort ? 'text-danger' : 'text-muted'
        }`}
      >
        {[state, movement].filter(Boolean).join(' · ')}
        {source.isArchived && ` · ${m.pos_archived()}`}
      </span>
    </li>
  )
}
