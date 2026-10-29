import {
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react'
import { Dialog } from 'radix-ui'

const subscribeViewport = (notify: () => void) => {
  const viewport = window.visualViewport
  viewport?.addEventListener('resize', notify)
  viewport?.addEventListener('scroll', notify)
  return () => {
    viewport?.removeEventListener('resize', notify)
    viewport?.removeEventListener('scroll', notify)
  }
}
const viewportSnapshot = () =>
  window.visualViewport
    ? `${window.visualViewport.height}:${window.visualViewport.offsetTop}`
    : ''

/** Explicit cancel/save own dismissal: incidental taps and Escape preserve drafts. */
export const LedgerEditor = ({
  open,
  title,
  onClose,
  children,
  returnFocusRef,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  returnFocusRef?: RefObject<HTMLElement | null>
}) => {
  const returnFocus = useRef<HTMLElement | null>(null)
  const viewport = useSyncExternalStore(
    subscribeViewport,
    viewportSnapshot,
    () => '',
  )
  const [height, top] = viewport.split(':').map(Number)
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[3px]" />
        <Dialog.Content
          aria-describedby={undefined}
          style={
            viewport
              ? {
                  maxHeight: `calc(${height}px - 2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))`,
                  top: `${top + height / 2}px`,
                }
              : undefined
          }
          onOpenAutoFocus={() => {
            returnFocus.current =
              returnFocusRef?.current ?? (document.activeElement as HTMLElement)
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocus.current?.focus()
          }}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          className="bg-card lift-shadow fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-[min(94vw,720px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
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
