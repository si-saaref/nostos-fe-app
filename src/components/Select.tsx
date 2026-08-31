import { Select as RadixSelect } from 'radix-ui'
import { RIM_CLASS } from '@/theme/rims'
import type { RimIndex } from '@/theme/rims'

export interface SelectOption {
  value: string
  label: string
  /** Category rim, so the picker looks like the rows it filters. */
  rim?: RimIndex
  hint?: string
}

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** Shown when nothing is chosen; choosing it clears the value. */
  placeholder?: string
  disabled?: boolean
  /** Hide the label visually — the placeholder already names the control. */
  hideLabel?: boolean
  /**
   * Validation message. Without a slot for this a required Select can block a
   * submit while explaining nothing, which reads as a broken button.
   */
  error?: string
}

/**
 * A native <select> renders its list in the OS, where none of our tokens
 * reach — it is the one control that drops out of the app's world entirely.
 * Radix gives us the listbox in the DOM so it can be a lifted plate like
 * everything else, while keeping the keyboard and screen-reader behaviour that
 * makes a native select worth imitating.
 *
 * Radix forbids an empty string value, so "no choice" travels as a sentinel and
 * is translated back at the boundary; callers still see '' for unset.
 */
const UNSET = '__unset__'

export const Select = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  hideLabel = false,
  error,
}: Props) => {
  const selected = options.find((option) => option.value === value)

  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span
          className={
            hideLabel
              ? 'sr-only'
              : 'text-muted text-[9px] font-bold tracking-[0.11em] uppercase'
          }
        >
          {label}
        </span>

        <RadixSelect.Root
          value={value === '' ? UNSET : value}
          disabled={disabled}
          onValueChange={(next) => onChange(next === UNSET ? '' : next)}
        >
          <RadixSelect.Trigger
            aria-label={label}
            aria-invalid={error ? true : undefined}
            className={`well-shadow bg-chip flex items-center gap-2 rounded-lg px-3 py-2 text-[11.5px] font-medium outline-none disabled:opacity-60 data-[state=open]:ring-2 data-[state=open]:ring-[var(--accent)] ${
              error ? 'ring-danger ring-2' : ''
            }`}
          >
            {selected?.rim && (
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${RIM_CLASS[selected.rim]}`}
              />
            )}
            <RadixSelect.Value
              placeholder={
                <span className="text-muted">{placeholder ?? label}</span>
              }
              className={selected ? 'text-ink' : 'text-muted'}
            />
            <RadixSelect.Icon className="text-muted ml-auto">
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                aria-hidden="true"
              >
                <path
                  d="M2 4l3 3 3-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </RadixSelect.Icon>
          </RadixSelect.Trigger>

          <RadixSelect.Portal>
            <RadixSelect.Content
              position="popper"
              sideOffset={6}
              className="bg-card lift-shadow z-50 max-h-[min(320px,60vh)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl p-1"
            >
              <RadixSelect.Viewport>
                {placeholder && (
                  <Item value={UNSET} label={placeholder} muted />
                )}
                {options.map((option) => (
                  <Item
                    key={option.value}
                    value={option.value}
                    label={option.label}
                    hint={option.hint}
                    rim={option.rim}
                  />
                ))}
              </RadixSelect.Viewport>
            </RadixSelect.Content>
          </RadixSelect.Portal>
        </RadixSelect.Root>
      </label>

      {error && (
        <span role="alert" className="text-danger text-[10.5px]">
          {error}
        </span>
      )}
    </div>
  )
}

const Item = ({
  value,
  label,
  hint,
  rim,
  muted = false,
}: {
  value: string
  label: string
  hint?: string
  rim?: RimIndex
  muted?: boolean
}) => (
  <RadixSelect.Item
    value={value}
    className={`data-[highlighted]:bg-chip flex cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px] outline-none select-none data-[state=checked]:font-semibold ${
      muted ? 'text-muted' : 'text-ink'
    }`}
  >
    {rim ? (
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${RIM_CLASS[rim]}`}
      />
    ) : (
      <span aria-hidden="true" className="w-2.5 shrink-0" />
    )}
    <RadixSelect.ItemText>{label}</RadixSelect.ItemText>
    {hint && <span className="text-muted ml-1 text-[10px]">{hint}</span>}
    <RadixSelect.ItemIndicator className="text-accent ml-auto">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M2.5 6.5l2.5 2.5 4.5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </RadixSelect.ItemIndicator>
  </RadixSelect.Item>
)
