import { useMessages } from '@/i18n/useMessages'

interface Props {
  onSave: () => void
  onArchive?: () => void
  onRestore?: () => void
}

/** Save, and the reversible end-of-life pair. Never a delete. */
export const RowActions = ({ onSave, onArchive, onRestore }: Props) => {
  const m = useMessages()
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onSave}
        className="bg-accent text-accent-ink rounded-lg px-4 py-2 text-[12px] font-semibold"
      >
        {m.act_save()}
      </button>
      {onArchive && (
        <button
          type="button"
          onClick={onArchive}
          className="border-danger-line bg-danger-bg text-danger rounded-lg border px-3 py-2 text-[12px] font-semibold"
        >
          {m.act_archive()}
        </button>
      )}
      {onRestore && (
        <button
          type="button"
          onClick={onRestore}
          className="border-hair text-muted rounded-lg border px-3 py-2 text-[12px] font-semibold"
        >
          {m.act_restore()}
        </button>
      )}
    </div>
  )
}
