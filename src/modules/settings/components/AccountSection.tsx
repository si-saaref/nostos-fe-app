import { useState } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormField } from '@/components/FormField'
import { SettingPlate } from '@/modules/settings/components/SettingPlate'
import { SectionShell } from '@/modules/settings/components/SectionShell'
import { RowActions } from '@/modules/settings/components/RowActions'
import {
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
} from '@/modules/settings/api/accounts'
import { SETTINGS_ANCHORS } from '@/modules/settings/anchors'
import { formatCurrency } from '@/utils/formatters'
import { fromIsoDay, isoDay } from '@/utils/dates'
import { rimFor } from '@/theme/rims'
import type { Account, AccountKind } from '@/types/catalog'
import type { AccountInput } from '@/modules/settings/types/settings'

interface Props {
  householdId: string
  canManage: boolean
}

const emptyDraft = (): AccountInput => ({
  name: '',
  kind: 'cash',
  openingBalance: 0,
  asOf: isoDay(new Date()),
})

export const AccountSection = ({ householdId, canManage }: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const currency = useCurrency()
  const {
    data: accounts,
    isLoading,
    isError,
    refetch,
  } = useAccounts(householdId)
  const {
    mutate: create,
    isPending: isCreating,
    error: createError,
  } = useCreateAccount(householdId)
  const { mutate: update, error: updateError } = useUpdateAccount(householdId)

  const [openId, setOpenId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  // Two drafts, not one: opening a row used to overwrite whatever had been
  // typed into the add form, which was still on screen and still bound to it.
  const [newDraft, setNewDraft] = useState<AccountInput>(emptyDraft)
  const [editDraft, setEditDraft] = useState<AccountInput>(emptyDraft)
  const [accountToArchive, setAccountToArchive] = useState<Account | null>(null)

  const KINDS: Array<{ value: AccountKind; label: string }> = [
    { value: 'cash', label: m.acc_kind_cash() },
    { value: 'bank', label: m.acc_kind_bank() },
    { value: 'ewallet', label: m.acc_kind_ewallet() },
  ]
  const kindLabel = (kind: AccountKind) =>
    KINDS.find((option) => option.value === kind)?.label ?? kind

  const fields = (
    draft: AccountInput,
    setDraft: (next: AccountInput) => void,
  ) => (
    <div className="flex flex-wrap items-end gap-2">
      <FormField label={m.acc_name()} className="min-w-[180px] flex-1">
        <input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
        />
      </FormField>
      <FormField label={m.acc_kind()}>
        <select
          value={draft.kind}
          onChange={(event) =>
            setDraft({ ...draft, kind: event.target.value as AccountKind })
          }
          className="well-shadow bg-chip rounded-lg px-3 py-2 text-[12.5px] outline-none"
        >
          {KINDS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label={m.acc_opening()}>
        <input
          type="number"
          inputMode="numeric"
          value={draft.openingBalance}
          onChange={(event) =>
            setDraft({ ...draft, openingBalance: Number(event.target.value) })
          }
          className="well-shadow bg-chip tnum w-[140px] rounded-lg px-3 py-2 text-[12.5px] outline-none"
        />
      </FormField>
      <FormField label={m.acc_as_of()}>
        <input
          type="date"
          value={draft.asOf}
          onChange={(event) => setDraft({ ...draft, asOf: event.target.value })}
          className="well-shadow bg-chip rounded-lg px-3 py-2 text-[12.5px] outline-none"
        />
      </FormField>
    </div>
  )

  return (
    <SectionShell
      id={SETTINGS_ANCHORS.accounts}
      title={m.acc_title()}
      description={m.acc_desc()}
      note={m.acc_balance_note()}
      canManage={canManage}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
      actionError={createError ?? updateError}
      isEmpty={(accounts?.length ?? 0) === 0}
      emptyText={m.acc_empty()}
      addLabel={m.acc_add()}
      onAdd={
        canManage
          ? () => {
              setNewDraft(emptyDraft())
              setIsAdding(true)
            }
          : undefined
      }
    >
      <ul className="flex flex-col gap-1.5">
        {isAdding && (
          <li className="bg-card lift-shadow flex flex-col gap-3 rounded-lg p-3">
            {fields(newDraft, setNewDraft)}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  create(
                    { ...newDraft, name: newDraft.name.trim() },
                    { onSuccess: () => setIsAdding(false) },
                  )
                }
                disabled={isCreating || !newDraft.name.trim()}
                className="bg-accent text-accent-ink rounded-lg px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
              >
                {isCreating ? m.act_saving() : m.act_add()}
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="border-hair text-muted rounded-lg border px-4 py-2 text-[12px] font-semibold"
              >
                {m.act_cancel()}
              </button>
            </div>
          </li>
        )}

        {accounts?.map((account) => {
          const isOpen = openId === account.id
          return (
            <SettingPlate
              key={account.id}
              title={account.name}
              meta={`${kindLabel(account.kind)} · ${m.acc_opening()} ${formatCurrency(
                account.openingBalance,
                currency,
                locale,
              )} · ${m.acc_as_of()} ${new Intl.DateTimeFormat(locale, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }).format(fromIsoDay(account.asOf))}`}
              rim={rimFor(account.order)}
              muted={Boolean(account.archivedAt)}
              trailing={
                account.archivedAt ? (
                  <span className="text-muted text-[10px] font-bold tracking-[0.08em] uppercase">
                    {m.cat_archived()}
                  </span>
                ) : undefined
              }
              isOpen={isOpen}
              onToggle={() => {
                setOpenId(isOpen ? null : account.id)
                setEditDraft({
                  name: account.name,
                  kind: account.kind,
                  openingBalance: account.openingBalance,
                  asOf: account.asOf,
                })
              }}
            >
              {canManage ? (
                <div className="flex flex-col gap-3">
                  {fields(editDraft, setEditDraft)}
                  <RowActions
                    onSave={() => {
                      update({
                        id: account.id,
                        ...editDraft,
                        name: editDraft.name.trim(),
                      })
                      setOpenId(null)
                    }}
                    onArchive={
                      account.archivedAt
                        ? undefined
                        : () => setAccountToArchive(account)
                    }
                    onRestore={
                      account.archivedAt
                        ? () => update({ id: account.id, archivedAt: null })
                        : undefined
                    }
                  />
                </div>
              ) : (
                <p className="text-muted text-[11.5px]">
                  {m.settings_admin_only()}
                </p>
              )}
            </SettingPlate>
          )
        })}
      </ul>

      <ConfirmDialog
        open={Boolean(accountToArchive)}
        onOpenChange={(open) => !open && setAccountToArchive(null)}
        title={m.archive_title({ name: accountToArchive?.name ?? '' })}
        body={m.archive_body({ name: accountToArchive?.name ?? '' })}
        confirmLabel={m.archive_confirm()}
        destructive
        onConfirm={() => {
          if (accountToArchive) {
            update({
              id: accountToArchive.id,
              archivedAt: isoDay(new Date()),
            })
          }
          setAccountToArchive(null)
          setOpenId(null)
        }}
      />
    </SectionShell>
  )
}
