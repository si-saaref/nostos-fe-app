import { useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { useDismiss } from '@/hooks/useDismiss'
import { RIM_CLASS } from '@/theme/rims'
import type { RimIndex } from '@/theme/rims'

interface Props {
  title: string
  titleBadge?: ReactNode
  secondaryValue?: ReactNode
  primaryValue?: ReactNode
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
  titleBadge,
  secondaryValue,
  primaryValue,
  meta,
  trailing,
  rim,
  muted = false,
  isOpen,
  onToggle,
  children,
}: Props) => {
  const panelId = useId()
  const titleId = useId()
  const metaId = useId()
  const valueId = useId()
  // Opening a row to look at it is not a commitment: clicking away or pressing
  // Escape puts it back, and the draft it held is discarded with it.
  const ref = useRef<HTMLElement>(null)
  useDismiss(ref, onToggle, isOpen)

  return (
    <li>
      <article
        ref={ref}
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

        <div className="relative">
          {/* Keep the disclosure and help triggers as siblings. The content
              lets pointer events through except for its independent controls. */}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-controls={panelId}
            aria-labelledby={titleId}
            aria-describedby={
              [meta && metaId, primaryValue && valueId]
                .filter(Boolean)
                .join(' ') || undefined
            }
            className="absolute inset-0 w-full rounded-lg"
          />
          <div
            className={`pointer-events-none relative ${
              secondaryValue
                ? 'grid grid-cols-2 items-start gap-3 px-4 py-3 text-left'
                : 'flex items-center gap-3 px-3 py-2.5 text-left'
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-1">
                <span
                  id={titleId}
                  title={title}
                  className="min-w-0 text-[12.5px] font-semibold break-words"
                >
                  {title}
                </span>
                {titleBadge && (
                  <span className="pointer-events-auto relative">
                    {titleBadge}
                  </span>
                )}
              </span>
              {meta && (
                <span
                  id={metaId}
                  className="text-muted mt-1 block pl-1 text-[10.5px]"
                >
                  {meta}
                </span>
              )}
            </span>
            {primaryValue && (
              <span id={valueId} className="min-w-0 text-right">
                <span className="tnum block text-sm font-semibold break-words">
                  {primaryValue}
                </span>
                {secondaryValue && (
                  <span className="text-muted mt-1 block text-[10.5px] font-normal">
                    {secondaryValue}
                  </span>
                )}
              </span>
            )}
            {trailing && (
              <span className="pointer-events-auto relative">{trailing}</span>
            )}
          </div>
        </div>

        {isOpen && (
          <div id={panelId} className="border-hair border-t px-3 py-3">
            {children}
          </div>
        )}
      </article>
    </li>
  )
}
