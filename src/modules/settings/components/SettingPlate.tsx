import { useId } from 'react'
import type { ReactNode } from 'react'
import { RIM_CLASS } from '@/theme/rims'
import type { RimIndex } from '@/theme/rims'

interface Props {
  title: string
  /** Secondary line: kind, balance, email — whatever identifies the row. */
  meta?: ReactNode
  /** Right-aligned status, before the disclosure. */
  trailing?: ReactNode
  rim?: RimIndex
  muted?: boolean
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}

/**
 * A settings row is the same plate as a ledger row, and opens the same way:
 * pull it and it lifts in place. The app teaches this interaction once on the
 * expenses tape and then never asks the user to learn a second one.
 */
export const SettingPlate = ({
  title,
  meta,
  trailing,
  rim,
  muted = false,
  isOpen,
  onToggle,
  children,
}: Props) => {
  const panelId = useId()

  return (
    <li>
      <article
        className={`bg-card relative overflow-hidden rounded-lg ${
          isOpen ? 'lift-shadow' : 'plate-shadow'
        } ${muted ? 'opacity-65' : ''}`}
      >
        {rim && (
          <span
            aria-hidden="true"
            className={`absolute inset-y-0 left-0 w-[3px] ${RIM_CLASS[rim]}`}
          />
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate pl-1 text-[12.5px] font-medium">
              {title}
            </span>
            {meta && (
              <span className="text-muted block truncate pl-1 text-[10.5px]">
                {meta}
              </span>
            )}
          </span>
          {trailing}
        </button>

        {isOpen && (
          <div id={panelId} className="border-hair border-t px-3 py-3">
            {children}
          </div>
        )}
      </article>
    </li>
  )
}
