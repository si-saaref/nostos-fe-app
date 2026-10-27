import { useState } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DismissablePanel } from '@/components/DismissablePanel'
import { FormField } from '@/components/FormField'
import { CategoryChipList } from '@/modules/settings/components/CategoryChipList'
import { SectionShell } from '@/modules/settings/components/SectionShell'
import {
  useCreateIncomeType,
  useIncomeTypes,
  useUpdateIncomeType,
} from '@/modules/settings/api/incomeCategories'
import { SETTINGS_ANCHORS } from '@/modules/settings/anchors'
import { isoDay } from '@/utils/dates'
import { capitalizeFirst } from '@/utils/text'
import type { CategoryChipItem } from '@/modules/settings/components/CategoryChipList'

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

  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [toArchive, setToArchive] = useState<CategoryChipItem | null>(null)

  const hasNone = (types?.length ?? 0) === 0
  const addType = (name: string, then?: () => void) => {
    const trimmed = capitalizeFirst(name.trim())
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

      {isAdding && (
        <DismissablePanel onDismiss={() => setIsAdding(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              addType(newName, () => {
                setNewName('')
                setIsAdding(false)
              })
            }}
            className="bg-card lift-shadow mb-3 flex flex-wrap items-end gap-2 rounded-lg p-3"
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
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="border-hair text-muted min-h-11 rounded-lg border px-4 py-2 text-[12px] font-semibold"
              >
                {m.act_cancel()}
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="bg-accent text-accent-ink min-h-11 rounded-lg px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
              >
                {isCreating ? m.act_saving() : m.act_add()}
              </button>
            </div>
          </form>
        </DismissablePanel>
      )}

      <CategoryChipList
        items={types ?? []}
        domain="income"
        canManage={canManage}
        nameLabel={m.itype_name()}
        archivedLabel={m.itype_archived()}
        saveLabel={m.act_save()}
        archiveLabel={m.act_archive()}
        restoreLabel={m.act_restore()}
        onRename={(type, name) =>
          update({ id: type.id, name: capitalizeFirst(name) })
        }
        onArchive={setToArchive}
        onRestore={(type) => update({ id: type.id, archivedAt: null })}
      />

      <ConfirmDialog
        open={Boolean(toArchive)}
        onOpenChange={(open) => !open && setToArchive(null)}
        title={m.archive_title({ name: toArchive?.name ?? '' })}
        body={m.archive_body({ name: toArchive?.name ?? '' })}
        confirmLabel={m.archive_confirm()}
        destructive
        onConfirm={() => {
          if (toArchive) {
            // Local day, never toISOString(): east of UTC that stamps
            // yesterday for anything archived before 07:00.
            update({ id: toArchive.id, archivedAt: isoDay(new Date()) })
          }
          setToArchive(null)
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
