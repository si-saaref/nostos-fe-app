import { useState } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DismissablePanel } from '@/components/DismissablePanel'
import { FormField } from '@/components/FormField'
import { CategoryChipList } from '@/modules/settings/components/CategoryChipList'
import { SectionShell } from '@/modules/settings/components/SectionShell'
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
} from '@/modules/settings/api/categories'
import { SETTINGS_ANCHORS } from '@/modules/settings/anchors'
import { isoDay } from '@/utils/dates'
import { capitalizeFirst } from '@/utils/text'
import type { CategoryChipItem } from '@/modules/settings/components/CategoryChipList'

interface Props {
  householdId: string
  canManage: boolean
}

export const CategorySection = ({ householdId, canManage }: Props) => {
  const m = useMessages()
  const {
    data: categories,
    isLoading,
    isError,
    refetch,
  } = useCategories(householdId)
  const {
    mutate: create,
    isPending: isCreating,
    error: createError,
  } = useCreateCategory(householdId)
  const { mutate: update, mutateAsync: updateAsync, error: updateError } =
    useUpdateCategory(householdId)

  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [categoryToArchive, setCategoryToArchive] =
    useState<CategoryChipItem | null>(null)

  return (
    <SectionShell
      id={SETTINGS_ANCHORS.expenseCategories}
      title={m.cat_title()}
      description={m.cat_desc()}
      note={m.cat_rim_note()}
      canManage={canManage}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
      actionError={createError ?? updateError}
      isEmpty={(categories?.length ?? 0) === 0}
      emptyText={m.cat_empty()}
      addLabel={m.cat_add()}
      onAdd={canManage ? () => setIsAdding(true) : undefined}
    >
      {isAdding && (
        <DismissablePanel onDismiss={() => setIsAdding(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!newName.trim()) return
              create(
                { name: capitalizeFirst(newName.trim()) },
                {
                  onSuccess: () => {
                    setNewName('')
                    setIsAdding(false)
                  },
                },
              )
            }}
            className="bg-card lift-shadow mb-3 flex flex-wrap items-end gap-2 rounded-lg p-3"
          >
            <FormField label={m.cat_name()} className="min-w-[200px] flex-1">
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
        items={categories ?? []}
        domain="expense"
        canManage={canManage}
        nameLabel={m.cat_name()}
        archivedLabel={m.cat_archived()}
        saveLabel={m.act_save()}
        archiveLabel={m.act_archive()}
        restoreLabel={m.act_restore()}
        onRename={(category, name) =>
          updateAsync({ id: category.id, name: capitalizeFirst(name) })
        }
        onArchive={setCategoryToArchive}
        onRestore={(category) =>
          update({ id: category.id, archivedAt: null })
        }
      />

      <ConfirmDialog
        open={Boolean(categoryToArchive)}
        onOpenChange={(open) => !open && setCategoryToArchive(null)}
        title={m.archive_title({ name: categoryToArchive?.name ?? '' })}
        body={m.archive_body({ name: categoryToArchive?.name ?? '' })}
        confirmLabel={m.archive_confirm()}
        destructive
        onConfirm={() => {
          if (categoryToArchive) {
            // Local day, never toISOString(): east of UTC that stamps yesterday
            // for anything archived before 07:00.
            update({
              id: categoryToArchive.id,
              archivedAt: isoDay(new Date()),
            })
          }
          setCategoryToArchive(null)
        }}
      />
    </SectionShell>
  )
}
