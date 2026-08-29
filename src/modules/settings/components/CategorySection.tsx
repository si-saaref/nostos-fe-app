import { useState } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { ConfirmDialog } from '@/modules/settings/components/ConfirmDialog'
import { SettingPlate } from '@/modules/settings/components/SettingPlate'
import {
  Field,
  RowActions,
  SectionShell,
} from '@/modules/settings/components/parts'
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
} from '@/api/queries/settings'
import { useExpenses } from '@/api/queries/expenses'
import { rimFor } from '@/types/settings'
import type { Category } from '@/types/settings'

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
  const { mutate: create, isPending: creating } = useCreateCategory(householdId)
  const { mutate: update } = useUpdateCategory(householdId)

  // Usage count so archiving can state its consequence instead of implying one.
  const { data: expenses } = useExpenses(householdId, {
    page: 1,
    limit: 1000,
    sortBy: 'datePaid',
    sortOrder: 'desc',
  })

  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [archiving, setArchiving] = useState<Category | null>(null)

  const usageOf = (id: string) =>
    expenses?.items.filter((expense) => expense.typeId === id).length ?? 0

  return (
    <SectionShell
      id="kategori-pengeluaran"
      title={m.cat_title()}
      description={m.cat_desc()}
      note={m.cat_rim_note()}
      canManage={canManage}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
      isEmpty={(categories?.length ?? 0) === 0}
      emptyText={m.cat_empty()}
      addLabel={m.cat_add()}
      onAdd={canManage ? () => setAdding(true) : undefined}
    >
      <ul className="flex flex-col gap-1.5">
        {adding && (
          <li>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!newName.trim()) return
                create(
                  { name: newName.trim() },
                  {
                    onSuccess: () => {
                      setNewName('')
                      setAdding(false)
                    },
                  },
                )
              }}
              className="bg-card lift-shadow flex flex-wrap items-end gap-2 rounded-lg p-3"
            >
              <Field label={m.cat_name()} className="min-w-[200px] flex-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
                />
              </Field>
              <button
                type="submit"
                disabled={creating}
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
            </form>
          </li>
        )}

        {categories?.map((category) => {
          const isOpen = openId === category.id
          const used = usageOf(category.id)
          return (
            <SettingPlate
              key={category.id}
              title={category.name}
              meta={used > 0 ? m.cat_in_use({ n: used }) : undefined}
              rim={rimFor(category.order)}
              muted={Boolean(category.archivedAt)}
              trailing={
                category.archivedAt ? (
                  <span className="text-muted text-[10px] font-bold tracking-[0.08em] uppercase">
                    {m.cat_archived()}
                  </span>
                ) : undefined
              }
              isOpen={isOpen}
              onToggle={() => {
                setOpenId(isOpen ? null : category.id)
                setDraft(category.name)
              }}
            >
              <div className="flex flex-wrap items-end gap-2">
                <Field label={m.cat_name()} className="min-w-[200px] flex-1">
                  <input
                    value={draft}
                    disabled={!canManage}
                    onChange={(event) => setDraft(event.target.value)}
                    className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none disabled:opacity-60"
                  />
                </Field>
                {canManage && (
                  <RowActions
                    onSave={() => {
                      if (draft.trim() && draft !== category.name) {
                        update({ id: category.id, name: draft.trim() })
                      }
                      setOpenId(null)
                    }}
                    onArchive={
                      category.archivedAt
                        ? undefined
                        : () => setArchiving(category)
                    }
                    onRestore={
                      category.archivedAt
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
        open={Boolean(archiving)}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={m.archive_title({ name: archiving?.name ?? '' })}
        body={m.archive_body({ name: archiving?.name ?? '' })}
        note={
          archiving && usageOf(archiving.id) > 0
            ? m.archive_in_use({ n: usageOf(archiving.id) })
            : undefined
        }
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
