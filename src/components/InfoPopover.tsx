import { Popover } from 'radix-ui'
import type { ReactNode } from 'react'
import { useMessages } from '@/i18n/useMessages'

export const InfoPopover = ({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) => {
  const m = useMessages()
  return (
    <Popover.Root modal>
      <Popover.Trigger
        aria-label={label}
        title={label}
        className="text-accent min-h-11 min-w-11 rounded-full text-sm font-bold"
      >
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
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={label}
          sideOffset={6}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          className="bg-card text-ink lift-shadow z-50 max-w-[min(90vw,360px)] rounded-xl p-4 text-xs leading-relaxed"
        >
          {children}
          <Popover.Close
            aria-label={m.action_close()}
            className="text-accent mt-2 block min-h-11 px-3 font-semibold"
          >
            {m.action_close()}
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
