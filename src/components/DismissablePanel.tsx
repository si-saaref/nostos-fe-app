import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useDismiss } from '@/hooks/useDismiss'

interface Props {
  onDismiss: () => void
  className?: string
  children: ReactNode
}

/** An open panel that closes on a click away or on Escape. */
export const DismissablePanel = ({
  onDismiss,
  className = '',
  children,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, onDismiss)
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
