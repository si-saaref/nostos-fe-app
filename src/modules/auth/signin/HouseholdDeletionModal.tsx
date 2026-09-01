import { Dialog } from 'radix-ui'
import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { formatDate } from '@/utils/formatters'

interface Props {
  /** A date opens the modal; null keeps it shut. */
  deadline: string | null
  onDismiss: () => void
}

/**
 * The dead end at the far side of signin.
 *
 * Radix `Dialog` with `role="alertdialog"` rather than Radix `AlertDialog`:
 * `AlertDialog` suppresses outside-click dismissal by design, because it exists
 * to force a choice. There is no choice here — the visitor is being told
 * something — so the backdrop must dismiss, and `Dialog` is the primitive that
 * does that.
 *
 * The deadline and nothing else. No household name, no admin name or email:
 * this renders for an unauthenticated stranger who typed an address into a box,
 * and anything identifying would turn the signin form into a harvester.
 */
export const HouseholdDeletionModal = ({ deadline, onDismiss }: Props) => {
  const m = useMessages()
  const { locale } = useSettings()

  return (
    <Dialog.Root
      open={deadline !== null}
      onOpenChange={(open) => {
        if (!open) onDismiss()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[8px]" />
        <Dialog.Content
          role="alertdialog"
          className="bg-card lift-shadow fixed top-1/2 left-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 text-center"
          // Opened from a URL parameter or a failed request, so Radix has no
          // trigger to restore focus to. Without this, dismissing drops focus
          // to <body> and a keyboard user restarts from the top of the page.
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            document.getElementById('signin-email')?.focus()
          }}
        >
          <Dialog.Title className="font-display text-[15px] font-bold">
            {m.deletion_title()}
          </Dialog.Title>
          <Dialog.Description className="text-muted mt-2 text-[12px] leading-relaxed">
            {m.deletion_body({
              date: deadline ? formatDate(deadline, locale) : '',
            })}
          </Dialog.Description>

          <p className="bg-chip text-muted mt-3 rounded-lg px-3 py-2 text-[11px]">
            {m.deletion_note()}
          </p>

          <Dialog.Close asChild>
            <button
              type="button"
              className="border-hair text-ink mt-5 w-full rounded-lg border px-4 py-2 text-[12px] font-semibold"
            >
              {m.deletion_back()}
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
