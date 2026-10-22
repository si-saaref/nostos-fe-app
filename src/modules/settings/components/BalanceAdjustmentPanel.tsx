import { useState } from 'react'
import type { FormEvent } from 'react'
import { AmountInput } from '@/components/AmountInput'
import { DateField } from '@/components/DateField'
import { FormField } from '@/components/FormField'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { useMessages } from '@/i18n/useMessages'
import {
  useAdjustments,
  useCreateAdjustment,
} from '@/modules/settings/api/adjustments'
import { isoDay } from '@/utils/dates'
import { getErrorMessage } from '@/utils/errors'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { isValidMoney } from '@/utils/money'
import type { Account } from '@/types/catalog'
import type { CreateAdjustmentInput } from '@/modules/settings/api/adjustments'

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
  const create = useCreateAdjustment(householdId)
  const [isAdding, setIsAdding] = useState(false)
  const [direction, setDirection] =
    useState<CreateAdjustmentInput['direction']>('INCREASE')
  const [amount, setAmount] = useState<number | undefined>()
  const [date, setDate] = useState(isoDay(new Date()))
  const [reason, setReason] = useState('')
  const [validationError, setValidationError] = useState(false)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      amount === undefined ||
      !isValidMoney(amount) ||
      date < account.asOf ||
      date > isoDay(new Date()) ||
      !reason.trim()
    ) {
      setValidationError(true)
      return
    }
    setValidationError(false)
    create.mutate(
      { sourceId: account.id, direction, amount, date, reason },
      {
        onSuccess: () => {
          setIsAdding(false)
          setAmount(undefined)
          setReason('')
          setDate(isoDay(new Date()))
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
            onClick={() => setIsAdding(true)}
            className="border-hair rounded-lg border px-3 py-2 text-xs font-semibold"
          >
            {m.acc_adjust()}
          </button>
        )}
      </div>
      <p className="text-muted mt-1 text-xs">{m.acc_adjust_note()}</p>

      {isAdding && (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
          <FormField label={m.acc_adjust()}>
            <select
              value={direction}
              onChange={(event) =>
                setDirection(
                  event.target.value as CreateAdjustmentInput['direction'],
                )
              }
              className="well-shadow bg-chip rounded-lg px-3 py-2 text-xs"
            >
              <option value="INCREASE">{m.acc_adjust_increase()}</option>
              <option value="DECREASE">{m.acc_adjust_decrease()}</option>
            </select>
          </FormField>
          <AmountInput
            label={m.acc_adjust_amount()}
            value={amount}
            onChange={setAmount}
            className="w-[160px]"
          />
          <DateField
            label={m.acc_adjust_date()}
            value={date}
            onChange={setDate}
            max={isoDay(new Date())}
            className="w-[190px]"
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
            disabled={create.isPending}
            className="bg-accent text-accent-ink rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {create.isPending ? m.act_saving() : m.act_save()}
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
          {create.isError && (
            <p role="alert" className="text-xs text-red-600">
              {getErrorMessage(create.error)}
            </p>
          )}
        </form>
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
