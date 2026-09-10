import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { FormField } from '@/components/FormField'
import { useSettings } from '@/contexts/useSettings'
import { useCurrency } from '@/hooks/useCurrency'
import {
  decimalMark,
  groupAmount,
  isWholeUnitCurrency,
  normalizeAmountInput,
  parseAmount,
  toAmountInput,
} from '@/utils/amount'

interface Props {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  error?: string
  className?: string
  disabled?: boolean
  autoFocus?: boolean
}

const isTyped = (char: string, mark: string) =>
  (char >= '0' && char <= '9') || char === mark

const countTyped = (text: string, mark: string) =>
  [...text].filter((char) => isTyped(char, mark)).length

/**
 * Where the caret belongs once grouping has moved the separators around it.
 *
 * Measured from the right, by how many typed characters trail the caret —
 * counting from the left loses the decimal mark the user just entered and
 * drops the caret in front of it.
 */
const caretLeavingTail = (text: string, tail: number, mark: string) => {
  let index = text.length
  let seen = 0
  while (index > 0 && seen < tail) {
    index -= 1
    if (isTyped(text[index], mark)) seen += 1
  }
  return index
}

/**
 * Every figure of money the user types. A text field, not `type="number"`:
 * the spinner arrows were an invitation to nudge a salary by one rupiah, and
 * the ungrouped digits were unreadable at the length rupiah amounts run to.
 *
 * Grouping is applied on every keystroke, so the caret is put back after the
 * same digit it was after rather than at the end of the field.
 */
export const AmountInput = ({
  label,
  value,
  onChange,
  error,
  className = '',
  disabled = false,
  autoFocus = false,
}: Props) => {
  const { locale } = useSettings()
  const currency = useCurrency()
  const wholeUnit = isWholeUnitCurrency(currency)

  const inputRef = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const emitted = useRef(value)
  const [text, setText] = useState(() => toAmountInput(value, locale))

  // Reseed only when the value moved elsewhere — a form reset, another row
  // opened. Reseeding on every render would fight a half-typed figure.
  useEffect(() => {
    if (value === emitted.current) return
    emitted.current = value
    setText(toAmountInput(value, locale))
  }, [value, locale])

  useEffect(() => {
    if (caret.current == null) return
    inputRef.current?.setSelectionRange(caret.current, caret.current)
    caret.current = null
  }, [text])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value
    const mark = decimalMark(locale)
    const tail = countTyped(
      raw.slice(event.target.selectionStart ?? raw.length),
      mark,
    )
    const next = groupAmount(
      normalizeAmountInput(raw, locale, wholeUnit),
      locale,
    )
    caret.current = caretLeavingTail(next, tail, mark)
    setText(next)
    const parsed = parseAmount(next, locale, wholeUnit)
    emitted.current = parsed
    onChange(parsed)
  }

  return (
    <FormField label={label} error={error} className={className}>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        value={text}
        onChange={handleChange}
        aria-invalid={error ? true : undefined}
        className="well-shadow bg-chip tnum w-full rounded-lg px-3 py-2 text-[12.5px] outline-none disabled:opacity-60"
      />
    </FormField>
  )
}
