import { useState } from 'react'
import { DateField } from '@/components/DateField'
import { AmountInput } from '@/components/AmountInput'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/utils/formatters'
import { isValidMoney } from '@/utils/money'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { InfoPopover } from '@/components/InfoPopover'
import { useMessages } from '@/i18n/useMessages'
import { useHouseholdPrefs } from '@/modules/settings/api/prefs'
import { useUpdateAccount } from '@/modules/settings/api/accounts'
import { householdDay } from '@/modules/financial/lib/householdDay'
import { getErrorMessage } from '@/utils/errors'
import type { Account } from '@/types/catalog'

export const CalculationStart = ({
  account,
  householdId,
}: {
  account: Account
  householdId: string
}) => {
  const m = useMessages()
  const prefs = useHouseholdPrefs(householdId)
  const [date, setDate] = useState(account.asOf)
  const [amount, setAmount] = useState<number | undefined>()
  const { locale } = useSettings()
  const currency = useCurrency()
  const [confirm, setConfirm] = useState(false)
  const update = useUpdateAccount(householdId)
  const today = householdDay(new Date(), prefs.data?.timezone ?? 'Asia/Jakarta')
  const eligible =
    (account.baselineCanSet ?? account.calculationStartCanSet) === true &&
    !account.archivedAt
  const valid =
    !!date &&
    date <= today &&
    amount !== undefined &&
    (amount === 0 || isValidMoney(amount))
  return (
    <div className="border-hair border-t pt-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold">
          {eligible ? m.acc_baseline_pending() : m.acc_baseline_ready()}
        </p>
        <InfoPopover label={m.acc_start_help_title()} className="h-fit w-fit">
          {m.acc_start_help()}
        </InfoPopover>
      </div>
      {eligible ? (
        <>
          <p className="text-muted mb-3 text-xs">
            {m.acc_baseline_pending_note()}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <DateField
              label={m.acc_as_of()}
              value={date}
              onChange={setDate}
              max={today}
            />
            <AmountInput
              label={m.acc_opening()}
              value={amount}
              onChange={setAmount}
              allowZero
              className="min-w-40 flex-1"
            />
            <button
              type="button"
              disabled={update.isPending || !valid || !prefs.isSuccess}
              onClick={() => setConfirm(true)}
              className="bg-accent text-accent-ink min-h-11 rounded-lg px-3 text-xs font-semibold disabled:opacity-50"
            >
              {m.acc_start_assign()}
            </button>
          </div>
        </>
      ) : (
        <p className="text-muted text-xs">
          {m.acc_as_of()}: {account.asOf} · {m.acc_opening()}:{' '}
          {formatCurrency(account.openingBalance, currency, locale)}
        </p>
      )}
      {update.isError && (
        <p role="alert" className="text-danger mt-2 text-xs">
          {getErrorMessage(update.error)}
        </p>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={m.acc_start_assign()}
        body={m.acc_baseline_confirm({
          name: account.name,
          date,
          amount: formatCurrency(amount ?? 0, currency, locale),
        })}
        confirmLabel={m.acc_start_assign()}
        onConfirm={() => {
          if (eligible && valid)
            update.mutate({
              id: account.id,
              asOf: date,
              openingBalance: amount,
            })
        }}
      />
    </div>
  )
}
