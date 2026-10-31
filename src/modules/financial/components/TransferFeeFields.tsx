import { AmountInput } from '@/components/AmountInput'
import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/utils/formatters'
import { isValidMoney } from '@/utils/money'

interface Props {
  enabled: boolean
  onToggle: () => void
  fee: number | undefined
  onFeeChange: (value: number | undefined) => void
  error?: string
  amount: number | undefined
  fromName?: string
  toName?: string
}

export const TransferFeeFields = ({
  enabled,
  onToggle,
  fee,
  onFeeChange,
  error,
  amount,
  fromName,
  toName,
}: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const currency = useCurrency()
  const money = (value: number) => formatCurrency(value, currency, locale)
  const showPreview =
    enabled &&
    amount !== undefined &&
    isValidMoney(amount) &&
    fee !== undefined &&
    isValidMoney(fee) &&
    fromName &&
    toName
  return (
    <div className="col-span-full space-y-3">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className="border-hair flex min-h-11 w-full items-center justify-between gap-3 border-t py-2 text-left text-xs font-semibold"
      >
        <span>{m.transfer_fee_toggle()}</span>
        <span
          aria-hidden="true"
          className={`flex h-6 w-10 shrink-0 items-center rounded-full p-1 transition-colors ${enabled ? 'bg-accent' : 'bg-hair'}`}
        >
          <span
            className={`bg-card h-4 w-4 rounded-full transition-transform motion-reduce:transition-none ${enabled ? 'translate-x-4' : ''}`}
          />
        </span>
      </button>
      {enabled && (
        <AmountInput
          label={m.transfer_fee_label()}
          value={fee}
          onChange={onFeeChange}
          error={error}
        />
      )}
      {showPreview && (
        <div
          role="status"
          className="border-hair tnum space-y-1 border-t pt-3 text-xs"
        >
          <p className="font-semibold">
            {m.transfer_debit({
              account: fromName,
              amount: money(amount + fee),
            })}
          </p>
          <p>{m.transfer_credit({ account: toName, amount: money(amount) })}</p>
          <p className="text-muted">
            {m.transfer_fee_included({ amount: money(fee) })}
          </p>
        </div>
      )}
    </div>
  )
}
