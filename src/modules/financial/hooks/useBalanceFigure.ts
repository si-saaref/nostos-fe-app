import { useCurrentPositions } from '@/modules/financial/api/positions'
import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { formatCurrency } from '@/utils/formatters'
import type { StripFigure } from '@/modules/financial/components/StripShell'

export const useBalanceFigure = (householdId: string): StripFigure => {
  const positions = useCurrentPositions(householdId)
  const { locale } = useSettings()
  const m = useMessages()
  const summary = positions.data?.summary
  return {
    id: 'balance',
    key: m.balance_remaining(),
    value: positions.isError
      ? m.balance_unavailable()
      : summary
        ? formatCurrency(
            summary.totalBalanceText ?? summary.totalBalance,
            summary.currency,
            locale,
          )
        : '—',
    note: summary ? m.balance_today({ date: summary.asOf }) : undefined,
    isNil: !summary || positions.isError,
  }
}
