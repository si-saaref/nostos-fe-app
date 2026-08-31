import type { ReactNode } from 'react'

interface Props {
  label: string
  error?: string
  className?: string
  children: ReactNode
}

/**
 * Label, control, error — the same three parts everywhere a value is typed.
 *
 * The error sits outside the label on purpose: inside it, an error message
 * becomes part of the control's accessible name, so a screen reader announces
 * the field as "Amount Must be greater than zero".
 */
export const FormField = ({
  label,
  error,
  className = '',
  children,
}: Props) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <label className="flex flex-col gap-1">
      <span className="text-muted text-[9px] font-bold tracking-[0.11em] uppercase">
        {label}
      </span>
      {children}
    </label>
    {error && (
      <span role="alert" className="text-danger text-[10.5px]">
        {error}
      </span>
    )}
  </div>
)
