import { Dialog } from 'radix-ui'
import { useMessages } from '@/i18n/useMessages'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  body: string
  /** Extra consequence worth stating plainly before the user commits. */
  note?: string
  confirmLabel: string
  onConfirm: () => void
  destructive?: boolean
}

/**
 * The dialog for a choice. Everything else opens in place — a dialog is
 * reserved for the one moment where the user must stop and answer.
 *
 * The signin deletion modal is the other dialog in the product, and is not
 * this: it announces a dead end rather than asking anything.
 *
 * Radix supplies the parts that are genuinely hard to hand-roll and easy to get
 * wrong: focus trap, focus restored to the trigger, Escape, and the aria wiring.
 */
export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  body,
  note,
  confirmLabel,
  onConfirm,
  destructive = false,
}: Props) => {
  const m = useMessages()

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[3px]" />
        <Dialog.Content className="bg-card lift-shadow fixed top-1/2 left-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5">
          <Dialog.Title className="font-display text-[15px] font-bold">
            {title}
          </Dialog.Title>
          <Dialog.Description className="text-muted mt-2 text-[12px] leading-relaxed">
            {body}
          </Dialog.Description>

          {note && (
            <p className="bg-chip text-muted mt-3 rounded-lg px-3 py-2 text-[11px]">
              {note}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="border-hair text-muted rounded-lg border px-4 py-2 text-[12px] font-semibold"
              >
                {m.act_cancel()}
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
              className={
                destructive
                  ? 'border-danger-line bg-danger-bg text-danger rounded-lg border px-4 py-2 text-[12px] font-semibold'
                  : 'bg-accent text-accent-ink rounded-lg px-4 py-2 text-[12px] font-semibold'
              }
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
