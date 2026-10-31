import { useHousehold } from '@/contexts/useHousehold'
import { useSettings } from '@/contexts/useSettings'
import { useCurrentPositions } from '@/modules/financial/api/positions'
import { formatCurrency } from '@/utils/formatters'

export const HouseholdBalance = () => {
  const { householdId } = useHousehold()
  const { locale, lang } = useSettings()
  const positions = useCurrentPositions(householdId)
  const summary = positions.data?.summary
  return (
    <section
      aria-label={
        lang === 'id'
          ? 'Saldo rumah tangga hari ini'
          : 'Household balance today'
      }
      className="border-hair mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b pb-3"
    >
      <div className="text-muted text-xs">
        {lang === 'id'
          ? 'Saldo rumah tangga hari ini'
          : 'Household balance today'}
        {summary && <span className="ml-2">· {summary.asOf}</span>}
      </div>
      <strong className="tnum text-xl">
        {positions.isError
          ? lang === 'id'
            ? 'Saldo tidak tersedia'
            : 'Balance unavailable'
          : summary
            ? formatCurrency(
                summary.totalBalanceText ?? summary.totalBalance,
                summary.currency,
                locale,
              )
            : '—'}
      </strong>
    </section>
  )
}
