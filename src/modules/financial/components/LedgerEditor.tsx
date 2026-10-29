import { useRef, type ReactNode } from 'react'
import { Dialog } from 'radix-ui'

/** Explicit cancel/save own dismissal: incidental taps and Escape preserve drafts. */
export const LedgerEditor = ({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) => {
  const returnFocus = useRef<HTMLElement | null>(null)
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/35" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement as HTMLElement
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocus.current?.focus()
          }}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          className="bg-card lift-shadow fixed top-[max(1rem,env(safe-area-inset-top))] left-1/2 z-50 max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-[min(94vw,720px)] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
        >
          <Dialog.Title className="font-display mb-4 text-base font-bold">
            {title}
          </Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
