import { useState } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { ConfirmDialog } from '@/modules/settings/components/ConfirmDialog'
import { SettingPlate } from '@/modules/settings/components/SettingPlate'
import {
  Field,
  RowActions,
  SectionShell,
} from '@/modules/settings/components/parts'
import {
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
} from '@/api/queries/settings'
import { formatCurrency } from '@/utils/formatters'
import { fromIsoDay, isoDay } from '@/utils/dates'
import { rimFor } from '@/types/settings'
import type { Account, AccountKind } from '@/types/settings'

interface Props {
  householdId: string
  canManage: boolean
}

const emptyDraft = () => ({
  name: '',
  kind: 'cash' as AccountKind,
  openingBalance: 0,
  asOf: isoDay(new Date()),
})

export const AccountSection = ({ householdId, canManage }: Props) => {
  const m = useMessages()
  const { locale } = useSettings()
  const {
    data: accounts,
    isLoading,
    isError,
    refetch,
  } = useAccounts(householdId)
  const { mutate: create, isPending: creating } = useCreateAccount(householdId)
  const { mutate: update } = useUpdateAccount(householdId)

  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(emptyDraft())
  const [archiving, setArchiving] = useState<Account | null>(null)

  const KINDS: Array<{ value: AccountKind; label: string }> = [
    { value: 'cash', label: m.acc_kind_cash() },
    { value: 'bank', label: m.acc_kind_bank() },
    { value: 'ewallet', label: m.acc_kind_ewallet() },
  ]
  const kindLabel = (kind: AccountKind) =>
    KINDS.find((option) => option.value === kind)?.label ?? kind

  const fields = () => (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={m.acc_name()} className="min-w-[180px] flex-1">
        <input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
        />
      </Field>
      <Field label={m.acc_kind()}>
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
      </Field>
      <Field label={m.acc_opening()}>
        <input
          type="number"
          inputMode="numeric"
          value={draft.openingBalance}
          onChange={(event) =>
            setDraft({ ...draft, openingBalance: Number(event.target.value) })
          }
          className="well-shadow bg-chip tnum w-[140px] rounded-lg px-3 py-2 text-[12.5px] outline-none"
        />
      </Field>
      <Field label={m.acc_as_of()}>
        <input
          type="date"
          value={draft.asOf}
          onChange={(event) => setDraft({ ...draft, asOf: event.target.value })}
          className="well-shadow bg-chip rounded-lg px-3 py-2 text-[12.5px] outline-none"
        />
      </Field>
    </div>
  )

  return (
    <SectionShell
      id="akun"
      title={m.acc_title()}
      description={m.acc_desc()}
      note={m.acc_balance_note()}
      canManage={canManage}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
      isEmpty={(accounts?.length ?? 0) === 0}
      emptyText={m.acc_empty()}
      addLabel={m.acc_add()}
      onAdd={
        canManage
          ? () => {
              setDraft(emptyDraft())
              setAdding(true)
            }
          : undefined
      }
    >
      <ul className="flex flex-col gap-1.5">
        {adding && (
          <li className="bg-card lift-shadow flex flex-col gap-3 rounded-lg p-3">
            {fields()}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  create(
                    { ...draft, name: draft.name.trim() },
                    { onSuccess: () => setAdding(false) },
                  )
                }
                disabled={creating || !draft.name.trim()}
                className="bg-accent text-accent-ink rounded-lg px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
              >
                {creating ? m.act_saving() : m.act_add()}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
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
                'IDR',
                locale,
              )} · ${m.acc_as_of()} ${new Intl.DateTimeFormat(locale, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }).format(fromIsoDay(account.asOf))}`}
              rim={rimFor(account.order)}
              muted={Boolean(account.archivedAt)}
              isOpen={isOpen}
              onToggle={() => {
                setOpenId(isOpen ? null : account.id)
                setDraft({
                  name: account.name,
                  kind: account.kind,
                  openingBalance: account.openingBalance,
                  asOf: account.asOf,
                })
              }}
            >
              {canManage ? (
                <div className="flex flex-col gap-3">
                  {fields()}
                  <RowActions
                    onSave={() => {
                      update({
                        id: account.id,
                        ...draft,
                        name: draft.name.trim(),
                      })
                      setOpenId(null)
                    }}
                    onArchive={
                      account.archivedAt
                        ? undefined
                        : () => setArchiving(account)
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
        open={Boolean(archiving)}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={m.archive_title({ name: archiving?.name ?? '' })}
        body={m.archive_body({ name: archiving?.name ?? '' })}
        confirmLabel={m.archive_confirm()}
        destructive
        onConfirm={() => {
          if (archiving) {
            update({
              id: archiving.id,
              archivedAt: new Date().toISOString().slice(0, 10),
            })
          }
          setArchiving(null)
          setOpenId(null)
        }}
      />
    </SectionShell>
  )
}
