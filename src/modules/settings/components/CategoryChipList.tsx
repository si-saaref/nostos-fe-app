import { useState } from 'react'
import { FormField } from '@/components/FormField'
import { categoryIcon } from '@/modules/settings/lib/categoryIcon'
import type {
  CategoryDomain,
  CategorySystemKey,
} from '@/modules/settings/lib/categoryIcon'

export interface CategoryChipItem {
  id: string
  name: string
  systemKey: CategorySystemKey | null
  archivedAt: string | null
}

interface Props {
  items: CategoryChipItem[]
  domain: CategoryDomain
  canManage: boolean
  nameLabel: string
  archivedLabel: string
  saveLabel: string
  archiveLabel: string
  restoreLabel: string
  onRename: (item: CategoryChipItem, name: string) => Promise<unknown>
  onArchive: (item: CategoryChipItem) => void
  onRestore: (item: CategoryChipItem) => void
}

export const CategoryChipList = ({
  items,
  domain,
  canManage,
  nameLabel,
  archivedLabel,
  saveLabel,
  archiveLabel,
  restoreLabel,
  onRename,
  onArchive,
  onRestore,
}: Props) => {
  const [openId, setOpenId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const close = () => setOpenId(null)

  return (
    <ul className="flex flex-wrap items-start gap-2">
      {items.map((item) => {
        const isOpen = openId === item.id
        const isArchived = Boolean(item.archivedAt)
        const isSaving = savingId === item.id
        return (
          <li key={item.id} className={isOpen ? 'w-full' : 'max-w-full'}>
            <button
              type="button"
              disabled={!canManage}
              aria-expanded={isOpen}
              onClick={() => {
                if (!canManage) return
                setOpenId(isOpen ? null : item.id)
                setDraftName(item.name)
              }}
              className={`border-hair bg-card plate-shadow flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3 py-2 text-left text-[12px] font-semibold ${
                isArchived
                  ? 'text-muted opacity-65'
                  : 'hover:bg-chip disabled:hover:bg-card'
              }`}
            >
              <span className="text-accent">
                {categoryIcon(item.systemKey, domain)}
              </span>
              <span className="break-words">{item.name}</span>
              {isArchived && (
                <span className="text-[9px] tracking-[0.06em] uppercase">
                  {archivedLabel}
                </span>
              )}
            </button>

            {isOpen && canManage && (
              <form
                onSubmit={async (event) => {
                  event.preventDefault()
                  const name = draftName.trim()
                  if (!name) return
                  if (name === item.name) {
                    close()
                    return
                  }
                  setSavingId(item.id)
                  try {
                    await onRename(item, name)
                    close()
                  } catch {
                    // The owning section renders the mutation error. Keeping
                    // this disclosure open preserves the rejected draft.
                  } finally {
                    setSavingId(null)
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && !isSaving) {
                    event.preventDefault()
                    close()
                  }
                }}
                className="bg-card lift-shadow mt-2 flex flex-wrap items-end gap-2 rounded-xl p-3"
              >
                <FormField label={nameLabel} className="min-w-[200px] flex-1">
                  <input
                    autoFocus
                    value={draftName}
                    disabled={isArchived || isSaving}
                    onChange={(event) => setDraftName(event.target.value)}
                    className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none disabled:opacity-60"
                  />
                </FormField>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {isArchived ? (
                    <button
                      type="button"
                      onClick={() => {
                        onRestore(item)
                        close()
                      }}
                      className="bg-accent text-accent-ink min-h-11 rounded-lg px-4 py-2 text-[12px] font-semibold"
                    >
                      {restoreLabel}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onArchive(item)
                          close()
                        }}
                        className="border-danger-line bg-danger-bg text-danger min-h-11 rounded-lg border px-3 py-2 text-[12px] font-semibold"
                      >
                        {archiveLabel}
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-accent text-accent-ink min-h-11 rounded-lg px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
                      >
                        {saveLabel}
                      </button>
                    </>
                  )}
                </div>
              </form>
            )}
          </li>
        )
      })}
    </ul>
  )
}
