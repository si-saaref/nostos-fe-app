import type { ReactNode } from 'react'
import { useMessages } from '@/i18n/useMessages'

export const Field = ({
  label,
  error,
  className = '',
  children,
}: {
  label: string
  error?: string
  className?: string
  children: ReactNode
}) => (
  <label className={`flex flex-col gap-1 ${className}`}>
    <span className="text-muted text-[9px] font-bold tracking-[0.11em] uppercase">
      {label}
    </span>
    {children}
    {error && (
      <span role="alert" className="text-danger text-[10.5px]">
        {error}
      </span>
    )}
  </label>
)

export const RowActions = ({
  onSave,
  onArchive,
  onRestore,
}: {
  onSave: () => void
  onArchive?: () => void
  onRestore?: () => void
}) => {
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

interface ShellProps {
  id: string
  title: string
  description: string
  note?: string
  canManage: boolean
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  isEmpty?: boolean
  emptyText?: string
  addLabel?: string
  onAdd?: () => void
  children: ReactNode
}

/**
 * One section of the configuration document. Sections are anchors in a single
 * scroll rather than tabs, so what else is configurable stays visible.
 */
export const SectionShell = ({
  id,
  title,
  description,
  note,
  canManage,
  isLoading,
  isError,
  onRetry,
  isEmpty,
  emptyText,
  addLabel,
  onAdd,
  children,
}: ShellProps) => {
  const m = useMessages()
  return (
    <section id={id} className="scroll-mt-4 pt-2 pb-8">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[17px] font-bold">{title}</h2>
          <p className="text-muted mt-1 max-w-prose text-[11.5px] leading-relaxed">
            {description}
          </p>
        </div>
        {onAdd && addLabel && (
          <button
            type="button"
            onClick={onAdd}
            className="bg-accent text-accent-ink shrink-0 rounded-lg px-4 py-2 text-[12px] font-semibold"
          >
            + {addLabel}
          </button>
        )}
      </header>

      {!canManage && (
        <p className="bg-chip text-muted mb-3 rounded-lg px-3 py-2 text-[11px]">
          {m.settings_admin_only()}
        </p>
      )}

      {isLoading && (
        <p
          role="status"
          aria-live="polite"
          className="text-muted py-4 text-[12px]"
        >
          {m.state_loading()}
        </p>
      )}

      {isError && (
        <div role="alert" className="bg-card plate-shadow rounded-xl p-4">
          <p className="text-[12px] font-semibold">{m.state_error()}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="bg-accent text-accent-ink mt-2 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold"
            >
              {m.state_retry()}
            </button>
          )}
        </div>
      )}

      {!isLoading && !isError && isEmpty && emptyText && (
        <p className="bg-card plate-shadow text-muted rounded-xl p-5 text-center text-[12px]">
          {emptyText}
        </p>
      )}

      {!isLoading && !isError && children}

      {note && <p className="text-muted mt-2.5 text-[10.5px]">{note}</p>}
    </section>
  )
}
