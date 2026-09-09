import { useId } from 'react'
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
  /**
   * Standing help for the control — what an unusual choice here *means*,
   * not what went wrong. It belongs on the field: a sentence about one picker
   * parked beside the submit button describes nothing the eye can connect it
   * to, and a screen reader never reaches it at all.
   */
  hint?: string
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
  hint,
}: Props) => {
  const selected = options.find((option) => option.value === value)
  const hintId = useId()
  // One line under the control, never two: a validation failure is the more
  // urgent of the two and the hint keeps its place once the field is fixed.
  const showHint = Boolean(hint) && !error

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
          {/* Open is signalled by the caret and a hairline, not by a 2px accent
              ring: the focus outline already draws one, and the two stacked
              read as an error state. */}
          <RadixSelect.Trigger
            aria-label={label}
            aria-invalid={error ? true : undefined}
            aria-describedby={showHint ? hintId : undefined}
            className={`well-shadow bg-chip ring-accent/45 group flex items-center gap-2 rounded-lg px-3 py-2 text-[11.5px] font-medium outline-none disabled:opacity-60 data-[state=open]:ring-1 ${
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
              className={selected ? 'text-ink font-semibold' : 'text-muted'}
            />
            <RadixSelect.Icon className="text-muted ml-auto transition-transform duration-150 group-data-[state=open]:rotate-180">
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
              className="bg-card lift-shadow z-50 max-h-[min(320px,60vh)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl p-1 outline-none"
            >
              <RadixSelect.Viewport>
                {/* The reset row is separated rather than sitting flush with
                    the values: it widens the view, it does not pick one. */}
                {placeholder && (
                  <>
                    <Item value={UNSET} label={placeholder} muted />
                    <RadixSelect.Separator className="bg-hair mx-1.5 my-1 h-px" />
                  </>
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

      {showHint && (
        <span id={hintId} className="text-muted text-[10.5px]">
          {hint}
        </span>
      )}
    </div>
  )
}

/**
 * Highlight and selection are two different facts, so they get two different
 * channels: the pointer/keyboard highlight is a background, the current value
 * is accent text plus the tick. Sharing one treatment made the checked row look
 * permanently hovered.
 */
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
    className={`data-[highlighted]:bg-chip data-[state=checked]:text-accent flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-[7px] text-[11.5px] outline-none select-none data-[state=checked]:font-semibold ${
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
