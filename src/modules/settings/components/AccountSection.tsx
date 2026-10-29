import { CalculationStart } from './CalculationStart'
import { InfoPopover } from '@/components/InfoPopover'
import { useCurrentPositions } from '@/modules/financial/api/positions'
import { useState } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DismissablePanel } from '@/components/DismissablePanel'
import { FormField } from '@/components/FormField'
import { SettingPlate } from '@/modules/settings/components/SettingPlate'
import { BalanceAdjustmentPanel } from '@/modules/settings/components/BalanceAdjustmentPanel'
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

const emptyDraft = (kind: AccountKind = 'cash'): AccountInput => ({
  name: '',
  kind,
  openingBalance: 0,
  asOf: isoDay(new Date()),
})

export const AccountSection = ({ householdId, canManage }: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const currency = useCurrency()
  const positions = useCurrentPositions(householdId)
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
  const [addingKind, setAddingKind] = useState<AccountKind | null>(null)
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
    disabled = false,
  ) => (
    <FormField label={m.acc_name()} className="min-w-0 flex-1">
      <input
        autoComplete="off"
        value={draft.name}
        disabled={disabled}
        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none disabled:opacity-60"
      />
    </FormField>
  )

  return (
    <SectionShell
      id={SETTINGS_ANCHORS.accounts}
      title={m.acc_title()}
      description={m.acc_desc()}

      canManage={canManage}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
      actionError={createError ?? updateError}
      isEmpty={(accounts?.length ?? 0) === 0}
      emptyText={m.acc_empty()}
      actions={
        canManage ? (
          <button
            type="button"
            onClick={() => {
              setIsAdding(true)
              setAddingKind(null)
              setNewDraft(emptyDraft())
            }}
            className="bg-accent text-accent-ink min-h-11 shrink-0 rounded-lg px-4 py-2 text-[12px] font-semibold"
          >
            + {m.acc_add()}
          </button>
        ) : undefined
      }
    >
      <ul className="flex flex-col gap-1.5">
        {isAdding && (
          <li>
            <DismissablePanel
              onDismiss={() => setIsAdding(false)}
              className="bg-card lift-shadow flex flex-col gap-3 rounded-lg p-3"
            >
              <fieldset>
                <legend className="text-muted mb-2 text-[10px] font-bold tracking-wider uppercase">
                  {m.acc_kind()}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {KINDS.map((option) => (
                    <label
                      key={option.value}
                      className={`focus-within:outline-accent flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold focus-within:outline-2 focus-within:outline-offset-2 ${addingKind === option.value ? 'border-accent bg-accent text-accent-ink' : 'border-hair text-ink'}`}
                    >
                      <input
                        type="radio"
                        name="account-kind"
                        value={option.value}
                        checked={addingKind === option.value}
                        onChange={() => setAddingKind(option.value)}
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {fields(newDraft, setNewDraft)}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="border-hair text-muted rounded-lg border px-4 py-2 text-[12px] font-semibold"
                >
                  {m.act_cancel()}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!addingKind) return
                    create(
                      { name: newDraft.name.trim(), kind: addingKind },
                      {
                        onSuccess: (account) => {
                          setIsAdding(false)
                          setAddingKind(null)
                          setOpenId(account.id)
                          setEditDraft({
                            name: account.name,
                            kind: account.kind,
                            openingBalance: account.openingBalance,
                            asOf: account.asOf,
                          })
                        },
                      },
                    )
                  }}
                  disabled={isCreating || !addingKind || !newDraft.name.trim()}
                  className="bg-accent text-accent-ink rounded-lg px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
                >
                  {isCreating ? m.act_saving() : m.act_add()}
                </button>
              </div>
            </DismissablePanel>
          </li>
        )}

        {accounts?.map((account) => {
          const position = positions.data?.items.find(
            (row) => row.sourceId === account.id,
          )
          const isOpen = openId === account.id
          const isArchived = Boolean(account.archivedAt)
          return (
            <SettingPlate
              key={account.id}
              title={account.name}
              primaryValue={
                <span className="block text-right">
                  <span className="text-muted block text-[10px] font-medium">
                    {m.acc_current_balance()} ·{' '}
                    {positions.data?.summary?.asOf ?? '—'}
                  </span>
                  <span>
                    {positions.isSuccess && position
                      ? formatCurrency(
                          position.balanceText ?? position.balance,
                          currency,
                          locale,
                        )
                      : '—'}
                  </span>
                </span>
              }
              meta={
                account.baselineStatus === 'UNVERIFIED' ? (
                  <span>
                    {kindLabel(account.kind)} · {m.acc_baseline_pending()}
                  </span>
                ) : (
                  <span className="flex flex-wrap items-baseline gap-x-1.5">
                    <span>{kindLabel(account.kind)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-ink tnum text-[12.5px] font-medium">
                      {m.acc_opening()}:{' '}
                      {formatCurrency(account.openingBalance, currency, locale)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {m.acc_as_of()}{' '}
                      {new Intl.DateTimeFormat(locale, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      }).format(fromIsoDay(account.asOf))}
                    </span>
                  </span>
                )
              }
              rim={rimFor(account.order)}
              muted={isArchived}
              trailing={
                isArchived ? (
                  <span className="text-muted text-[10px] font-bold tracking-[0.08em] uppercase">
                    {m.cat_archived()}
                  </span>
                ) : account.isProtected ? (
                  <span className="bg-chip text-muted rounded-full px-2 py-1 text-[9px] font-bold tracking-[0.06em] uppercase">
                    {m.acc_default_badge()}
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
                  <div className="flex items-end gap-1">
                    <div className="min-w-0 flex-1">
                      {fields(editDraft, setEditDraft, isArchived)}
                    </div>
                    {account.isProtected && (
                      <InfoPopover label={m.acc_default_badge()}>
                        {m.acc_protected_note()}
                      </InfoPopover>
                    )}
                  </div>
                  <CalculationStart
                    key={account.id}
                    account={account}
                    householdId={householdId}
                  />
                  <RowActions
                    onSave={() => {
                      update(
                        {
                          id: account.id,
                          name: editDraft.name.trim(),
                        },
                        { onSuccess: () => setOpenId(null) },
                      )
                    }}
                    onArchive={
                      isArchived || account.isProtected
                        ? undefined
                        : () => setAccountToArchive(account)
                    }
                    onRestore={
                      isArchived
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
              {account.baselineStatus !== 'UNVERIFIED' && (
                <BalanceAdjustmentPanel
                  householdId={householdId}
                  account={account}
                  canManage={canManage}
                />
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
