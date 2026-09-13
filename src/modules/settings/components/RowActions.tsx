import { useMessages } from '@/i18n/useMessages'

interface Props {
  onSave: () => void
  onArchive?: () => void
  onRestore?: () => void
}

/**
 * Save, and the reversible end-of-life pair. Never a delete.
 *
 * An archived row has exactly one useful action, and it is Restore — so
 * Restore takes the primary treatment there rather than the muted outline it
 * inherited from sitting beside Save, and Save is not rendered at all: the
 * fields above it are read-only until the row is back.
 */
export const RowActions = ({ onSave, onArchive, onRestore }: Props) => {
  const m = useMessages()
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {onRestore ? (
        <button
          type="button"
          onClick={onRestore}
          className="bg-accent text-accent-ink rounded-lg px-4 py-2 text-[12px] font-semibold"
        >
          {m.act_restore()}
        </button>
      ) : (
        <>
          {onArchive && (
            <button
              type="button"
              onClick={onArchive}
              className="border-danger-line bg-danger-bg text-danger rounded-lg border px-3 py-2 text-[12px] font-semibold"
            >
              {m.act_archive()}
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            className="bg-accent text-accent-ink rounded-lg px-4 py-2 text-[12px] font-semibold"
          >
            {m.act_save()}
          </button>
        </>
      )}
    </div>
  )
}
