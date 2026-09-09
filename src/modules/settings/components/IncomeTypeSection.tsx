import { useMemo, useState } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormField } from '@/components/FormField'
import { SettingPlate } from '@/modules/settings/components/SettingPlate'
import { SectionShell } from '@/modules/settings/components/SectionShell'
import { RowActions } from '@/modules/settings/components/RowActions'
import {
  useCreateIncomeType,
  useIncomeTypes,
  useUpdateIncomeType,
} from '@/modules/settings/api/incomeTypes'
import { MAX_PAGE_SIZE, useIncome } from '@/modules/financial/api/income'
import { SETTINGS_ANCHORS } from '@/modules/settings/anchors'
import { isoDay } from '@/utils/dates'
import type { IncomeType } from '@/types/income'

interface Props {
  householdId: string
  canManage: boolean
}

/**
 * The words a household uses for money coming in.
 *
 * Six presets are offered while the household has none of its own, and stop
 * the moment it has one. The PRD specified a five-minute client-side timer
 * after which they vanished forever; that was dropped on shaping
 * (`docs/SURFACE-INCOME.md` §9). A timer means `localStorage`, which is
 * per-device: the second admin would see the presets again on their phone, and
 * the first admin who was interrupted would have lost them for good. "Has this
 * household got any types yet" is the question the offer was always really
 * asking, and it has a real answer on the server.
 */
export const IncomeTypeSection = ({ householdId, canManage }: Props) => {
  const m = useMessages()
  const {
    data: types,
    isLoading,
    isError,
    refetch,
  } = useIncomeTypes(householdId)
  const {
    mutate: create,
    isPending: isCreating,
    error: createError,
  } = useCreateIncomeType(householdId)
  const { mutate: update, error: updateError } =
    useUpdateIncomeType(householdId)

  // Usage count, so archiving states its consequence instead of implying one.
  // Capped at the route's own ceiling: a rejected count would render as "used
  // by nobody", which is the one wrong answer here.
  const { data: income } = useIncome(householdId, {
    page: 1,
    limit: MAX_PAGE_SIZE,
  })

  const [openId, setOpenId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [toArchive, setToArchive] = useState<IncomeType | null>(null)

  // Counted once per fetch rather than filtered per row.
  const usageByName = useMemo(() => {
    const counts = new Map<string, number>()
    income?.items.forEach((row) => {
      counts.set(row.type, (counts.get(row.type) ?? 0) + 1)
    })
    return counts
  }, [income])
  const usageOf = (type: IncomeType) => usageByName.get(type.name) ?? 0

  const hasNone = (types?.length ?? 0) === 0
  const addType = (name: string, then?: () => void) => {
    const trimmed = name.trim()
    if (!trimmed) return
    create({ name: trimmed }, { onSuccess: then })
  }

  return (
    <SectionShell
      id={SETTINGS_ANCHORS.incomeTypes}
      title={m.itype_title()}
      description={m.itype_desc()}
      note={m.itype_note()}
      canManage={canManage}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
      actionError={createError ?? updateError}
      // The presets *are* the empty state here, so the shell's generic one
      // would be a second, weaker answer to the same moment.
      isEmpty={hasNone && !canManage}
      emptyText={m.itype_empty()}
      addLabel={m.itype_add()}
      onAdd={canManage ? () => setIsAdding(true) : undefined}
    >
      {hasNone && canManage && (
        <div className="bg-card plate-shadow mb-2 rounded-xl p-4">
          <h3 className="font-display text-[12.5px] font-bold">
            {m.itype_presets_title()}
          </h3>
          <p className="text-muted mt-1 max-w-prose text-[11.5px] leading-relaxed">
            {m.itype_presets_body()}
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {PRESET_KEYS.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={() => addType(m[key]())}
                  className="border-hair hover:bg-chip rounded-lg border px-3 py-1.5 text-[11.5px] font-semibold disabled:opacity-50"
                >
                  + {m[key]()}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {isAdding && (
          <li>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                addType(newName, () => {
                  setNewName('')
                  setIsAdding(false)
                })
              }}
              className="bg-card lift-shadow flex flex-wrap items-end gap-2 rounded-lg p-3"
            >
              <FormField
                label={m.itype_name()}
                className="min-w-[200px] flex-1"
              >
                <input
                  autoFocus
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
                />
              </FormField>
              <button
                type="submit"
                disabled={isCreating}
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
            </form>
          </li>
        )}

        {types?.map((type) => {
          const isOpen = openId === type.id
          const used = usageOf(type)
          return (
            <SettingPlate
              key={type.id}
              title={type.name}
              meta={
                used > 0
                  ? used === 1
                    ? m.itype_in_use_one()
                    : m.itype_in_use({ n: used })
                  : undefined
              }
              muted={Boolean(type.archivedAt)}
              trailing={
                type.archivedAt ? (
                  <span className="text-muted text-[10px] font-bold tracking-[0.08em] uppercase">
                    {m.itype_archived()}
                  </span>
                ) : undefined
              }
              isOpen={isOpen}
              onToggle={() => {
                setOpenId(isOpen ? null : type.id)
                setDraftName(type.name)
              }}
            >
              <div className="flex flex-wrap items-end gap-2">
                <FormField
                  label={m.itype_name()}
                  className="min-w-[200px] flex-1"
                >
                  <input
                    value={draftName}
                    disabled={!canManage}
                    onChange={(event) => setDraftName(event.target.value)}
                    className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none disabled:opacity-60"
                  />
                </FormField>
                {canManage && (
                  <RowActions
                    onSave={() => {
                      if (draftName.trim() && draftName !== type.name) {
                        update({ id: type.id, name: draftName.trim() })
                      }
                      setOpenId(null)
                    }}
                    onArchive={
                      type.archivedAt ? undefined : () => setToArchive(type)
                    }
                    onRestore={
                      type.archivedAt
                        ? () => update({ id: type.id, archivedAt: null })
                        : undefined
                    }
                  />
                )}
              </div>
            </SettingPlate>
          )
        })}
      </ul>

      <ConfirmDialog
        open={Boolean(toArchive)}
        onOpenChange={(open) => !open && setToArchive(null)}
        title={m.archive_title({ name: toArchive?.name ?? '' })}
        body={m.archive_body({ name: toArchive?.name ?? '' })}
        note={
          toArchive && usageOf(toArchive) > 0
            ? m.itype_in_use({ n: usageOf(toArchive) })
            : undefined
        }
        confirmLabel={m.archive_confirm()}
        destructive
        onConfirm={() => {
          if (toArchive) {
            // Local day, never toISOString(): east of UTC that stamps
            // yesterday for anything archived before 07:00.
            update({ id: toArchive.id, archivedAt: isoDay(new Date()) })
          }
          setToArchive(null)
          setOpenId(null)
        }}
      />
    </SectionShell>
  )
}

/**
 * The presets, as message keys rather than strings — they are offered in the
 * household's language, and a hardcoded "salary" would be the one untranslated
 * word on the page.
 */
const PRESET_KEYS = [
  'itype_preset_salary',
  'itype_preset_bonus',
  'itype_preset_gift',
  'itype_preset_withdrawal',
  'itype_preset_deposit',
  'itype_preset_refund',
] as const
