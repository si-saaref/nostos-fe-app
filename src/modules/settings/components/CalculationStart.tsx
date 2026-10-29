import { useState } from 'react'
import { DateField } from '@/components/DateField'
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
  const [confirm, setConfirm] = useState(false)
  const update = useUpdateAccount(householdId)
  const today = householdDay(new Date(), prefs.data?.timezone ?? 'Asia/Jakarta')
  const eligible =
    account.calculationStartCanSet === true && !account.archivedAt
  return (
    <div className="border-hair border-t pt-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold">
          {m.acc_as_of()}: {account.asOf}
        </p>
        <InfoPopover label={m.acc_start_help_title()}>
          {m.acc_start_help()}
        </InfoPopover>
      </div>
      {eligible ? (
        <div className="flex flex-wrap items-end gap-2">
          <DateField
            label={m.acc_as_of()}
            value={date}
            onChange={setDate}
            max={today}
          />
          <button
            type="button"
            disabled={
              update.isPending || !date || date > today || !prefs.isSuccess
            }
            onClick={() => setConfirm(true)}
            className="bg-accent text-accent-ink min-h-11 rounded-lg px-3 text-xs font-semibold disabled:opacity-50"
          >
            {m.acc_start_assign()}
          </button>
        </div>
      ) : (
        <p className="text-muted text-xs">{m.acc_start_locked()}</p>
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
        body={m.acc_start_confirm({ date })}
        confirmLabel={m.acc_start_assign()}
        onConfirm={() => {
          if (eligible && date && date <= today)
            update.mutate({ id: account.id, asOf: date })
        }}
      />
    </div>
  )
}
