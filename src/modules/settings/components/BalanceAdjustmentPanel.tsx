import { InfoPopover } from '@/components/InfoPopover'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { AmountInput } from '@/components/AmountInput'
import { FormField } from '@/components/FormField'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { useMessages } from '@/i18n/useMessages'
import {
  useAdjustments,
  useReconcileAccount,
} from '@/modules/settings/api/adjustments'
import { getErrorMessage } from '@/utils/errors'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { isValidSignedMoney } from '@/utils/money'
import type { Account } from '@/types/catalog'

interface Props {
  householdId: string
  account: Account
  canManage: boolean
}

export const BalanceAdjustmentPanel = ({
  householdId,
  account,
  canManage,
}: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const currency = useCurrency()
  const { data: rows, isError: listError } = useAdjustments(
    householdId,
    account.id,
    true,
  )
  const reconcile = useReconcileAccount(householdId)
  const [isAdding, setIsAdding] = useState(false)
  const [targetBalance, setTargetBalance] = useState<number | undefined>()
  const [reason, setReason] = useState('')
  const [validationError, setValidationError] = useState(false)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      targetBalance === undefined ||
      !isValidSignedMoney(targetBalance) ||
      !reason.trim()
    ) {
      setValidationError(true)
      return
    }
    setValidationError(false)
    reconcile.mutate(
      { sourceId: account.id, targetBalance, reason },
      {
        onSuccess: () => {
          setIsAdding(false)
          setTargetBalance(undefined)
          setReason('')
        },
      },
    )
  }

  return (
    <section className="border-hair mt-3 border-t pt-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">{m.acc_adjust_history()}</h4>
        {canManage && !isAdding && (
          <button
            type="button"
            onClick={() => {
              reconcile.reset()
              setValidationError(false)
              setIsAdding(true)
            }}
            className="border-hair rounded-lg border px-3 py-2 text-xs font-semibold"
          >
            {m.acc_adjust()}
          </button>
        )}
      </div>
      <InfoPopover label={m.acc_adjust_help_title()}>
        {m.acc_adjust_note()}
      </InfoPopover>

      {isAdding && (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
          <AmountInput
            label={m.acc_target_balance()}
            value={targetBalance}
            onChange={setTargetBalance}
            allowNegative
            allowZero
            className="w-[160px]"
          />
          <FormField
            label={m.acc_adjust_reason()}
            className="min-w-[210px] flex-1"
          >
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder={m.acc_adjust_reason_hint()}
              className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-xs"
            />
          </FormField>
          <button
            type="submit"
            disabled={reconcile.isPending}
            className="bg-accent text-accent-ink rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {reconcile.isPending ? m.act_saving() : m.act_save()}
          </button>
          <button
            type="button"
            onClick={() => setIsAdding(false)}
            className="border-hair rounded-lg border px-3 py-2 text-xs"
          >
            {m.act_cancel()}
          </button>
          {validationError && (
            <p role="alert" className="text-xs text-red-600">
              {m.acc_adjust_invalid()}
            </p>
          )}
          {reconcile.isError && (
            <p role="alert" className="text-xs text-red-600">
              {getErrorMessage(reconcile.error)}
            </p>
          )}
        </form>
      )}

      {reconcile.data && (
        <p role="status" className="bg-chip mt-3 rounded-lg px-3 py-2 text-xs">
          {m.acc_current_balance()}:{' '}
          <strong className="tnum text-[12.5px]">
            {formatCurrency(reconcile.data.balance, currency, locale)}
          </strong>
        </p>
      )}

      {listError && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {m.acc_adjust_load_error()}
        </p>
      )}
      {rows?.length === 0 && (
        <p className="text-muted mt-3 text-xs">{m.acc_adjust_empty()}</p>
      )}
      {rows && rows.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {rows.map((row) => (
            <li
              key={row.id}
              className="border-hair flex justify-between gap-3 border-b py-2"
            >
              <span>
                {formatDate(row.date, locale)} · {row.reason}
              </span>
              <strong className="tnum whitespace-nowrap">
                {row.delta > 0 ? '+' : '−'}
                {formatCurrency(Math.abs(row.delta), currency, locale)}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
