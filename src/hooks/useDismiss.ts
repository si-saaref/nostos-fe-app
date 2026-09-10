import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * Close on a click away or on Escape — the two gestures every editor in the
 * app should answer, so opening a row to look at it is never a commitment.
 *
 * A click inside a portalled overlay is still "inside": the archive dialog was
 * opened from this row, and dismissing the row underneath it would cancel the
 * question being asked. Radix marks a modal open by pinning
 * `pointer-events: none` on the body, which is the reliable signal for that.
 */
export const useDismiss = (
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  enabled = true,
) => {
  const latest = useRef(onDismiss)
  useEffect(() => {
    latest.current = onDismiss
  })

  useEffect(() => {
    if (!enabled) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node) || !ref.current) return
      if (ref.current.contains(target)) return
      if (document.body.style.pointerEvents === 'none') return
      if (
        target instanceof Element &&
        target.closest(
          '[role="dialog"], [role="alertdialog"], [role="listbox"]',
        )
      ) {
        return
      }
      latest.current()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latest.current()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [ref, enabled])
}
