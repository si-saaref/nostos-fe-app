import { Popover } from 'radix-ui'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

export const InfoPopover = ({
  label,
  children,
  className,
  triggerContent,
}: {
  label: string
  children: ReactNode
  className?: string
  /** Custom content for the help button; defaults to the info icon. */
  triggerContent?: ReactNode
}) => {
  const [open, setOpen] = useState(false)
  const pointerOpen = useRef<boolean | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const keepOpen = () => {
    clearTimeout(timer.current)
    setOpen(true)
  }
  const closeSoon = () => {
    timer.current = setTimeout(() => setOpen(false), 150)
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={label}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') keepOpen()
        }}
        onPointerLeave={closeSoon}
        onPointerDown={(event) => {
          pointerOpen.current = event.pointerType === 'touch' ? open : null
        }}
        onFocus={() => {
          if (pointerOpen.current === null) keepOpen()
        }}
        onBlur={closeSoon}
        onClick={(event) => {
          event.preventDefault()
          clearTimeout(timer.current)
          setOpen(pointerOpen.current === null ? true : !pointerOpen.current)
          pointerOpen.current = null
        }}
        className={`text-muted hover:text-ink inline-grid shrink-0 place-items-center rounded-full ${triggerContent == null ? 'h-11 w-11' : ''} ${className || ''}`}
      >
        {triggerContent ?? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6m0-10v1" />
          </svg>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={label}
          side="top"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onPointerEnter={keepOpen}
          onPointerLeave={closeSoon}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          className="bg-ink text-card z-[70] max-w-[min(85vw,280px)] rounded-xl px-3 py-2.5 text-xs leading-relaxed shadow-lg"
        >
          <p className="mb-1 font-semibold">{label}</p>
          <div className="opacity-85">{children}</div>
          <Popover.Arrow className="fill-ink" width={12} height={6} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
