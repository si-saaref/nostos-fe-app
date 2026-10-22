import { useState } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DismissablePanel } from '@/components/DismissablePanel'
import { FormField } from '@/components/FormField'
import { SettingPlate } from '@/modules/settings/components/SettingPlate'
import { SectionShell } from '@/modules/settings/components/SectionShell'
import { RowActions } from '@/modules/settings/components/RowActions'
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
} from '@/modules/settings/api/categories'
import { SETTINGS_ANCHORS } from '@/modules/settings/anchors'
import { rimFor } from '@/theme/rims'
import { isoDay } from '@/utils/dates'
import { capitalizeFirst } from '@/utils/text'
import type { Category } from '@/types/catalog'

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
  const { mutate: update, error: updateError } = useUpdateCategory(householdId)

  const [openId, setOpenId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [categoryToArchive, setCategoryToArchive] = useState<Category | null>(
    null,
  )

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
      <ul className="flex flex-col gap-1.5">
        {isAdding && (
          <li>
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
                className="bg-card lift-shadow flex flex-wrap items-end gap-2 rounded-lg p-3"
              >
                <FormField
                  label={m.cat_name()}
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
                    className="border-hair text-muted rounded-lg border px-4 py-2 text-[12px] font-semibold"
                  >
                    {m.act_cancel()}
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="bg-accent text-accent-ink rounded-lg px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
                  >
                    {isCreating ? m.act_saving() : m.act_add()}
                  </button>
                </div>
              </form>
            </DismissablePanel>
          </li>
        )}

        {categories?.map((category) => {
          const isOpen = openId === category.id
          const isArchived = Boolean(category.archivedAt)
          return (
            <SettingPlate
              key={category.id}
              title={category.name}
              rim={rimFor(category.order)}
              muted={isArchived}
              trailing={
                isArchived ? (
                  <span className="text-muted text-[10px] font-bold tracking-[0.08em] uppercase">
                    {m.cat_archived()}
                  </span>
                ) : undefined
              }
              isOpen={isOpen}
              onToggle={() => {
                setOpenId(isOpen ? null : category.id)
                setDraftName(category.name)
              }}
            >
              <div className="flex flex-wrap items-end gap-2">
                <FormField
                  label={m.cat_name()}
                  className="min-w-[200px] flex-1"
                >
                  <input
                    value={draftName}
                    disabled={!canManage || isArchived}
                    onChange={(event) => setDraftName(event.target.value)}
                    className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none disabled:opacity-60"
                  />
                </FormField>
                {canManage && (
                  <RowActions
                    onSave={() => {
                      const name = capitalizeFirst(draftName.trim())
                      if (name && name !== category.name) {
                        update(
                          { id: category.id, name },
                          { onSuccess: () => setOpenId(null) },
                        )
                      } else {
                        setOpenId(null)
                      }
                    }}
                    onArchive={
                      isArchived
                        ? undefined
                        : () => setCategoryToArchive(category)
                    }
                    onRestore={
                      isArchived
                        ? () => update({ id: category.id, archivedAt: null })
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
          setOpenId(null)
        }}
      />
    </SectionShell>
  )
}
