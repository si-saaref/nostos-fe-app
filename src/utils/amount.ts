/**
 * Typing an amount, in the household's own notation.
 *
 * A bare `<input type="number">` gave the field spinner arrows nobody wants on
 * a rupiah figure and printed `1000000`, which no one reads at a glance. So the
 * control is a text field and these functions carry the notation: separators
 * come from the locale, and whether the currency circulates a sub-unit comes
 * from the currency the household picked.
 *
 * Everything round-trips through a canonical string — digits with `.` as the
 * decimal point — so `Number()` is the only parse and the grouped display is
 * derived, never stored.
 */
import { MONEY_PLACES } from '@/utils/money'

/**
 * Currencies with no circulating sub-unit. Intl cannot answer this: ISO 4217
 * gives IDR two minor digits, but nobody has handed over a sen since the
 * 1960s. The list only governs whether a lone leading `0` is worth keeping —
 * two decimal places stay accepted everywhere, because the API accepts them
 * and a split bill is real.
 */
const WHOLE_UNIT = new Set(['IDR', 'JPY', 'KRW', 'VND'])

export const isWholeUnitCurrency = (currency: string): boolean =>
  WHOLE_UNIT.has(currency.toUpperCase())

const markOf = (locale: string, type: 'decimal' | 'group'): string =>
  new Intl.NumberFormat(locale)
    .formatToParts(11111.1)
    .find((part) => part.type === type)?.value ??
  (type === 'decimal' ? '.' : ',')

/** The separator this locale puts before a fraction: `,` in id-ID, `.` in en-US. */
export const decimalMark = (locale: string): string => markOf(locale, 'decimal')

/**
 * What the user typed, cleaned to the canonical form.
 *
 * Grouping characters are dropped because we inserted them; only the locale's
 * own decimal mark counts as one. Leading zeros go — and in a whole-unit
 * currency a lone `0` is nothing typed at all, while in dollars it survives to
 * become `0.75`.
 */
export const normalizeAmountInput = (
  raw: string,
  locale: string,
  wholeUnit: boolean,
): string => {
  const mark = decimalMark(locale)
  let digits = ''
  let hasPoint = false
  for (const char of raw) {
    if (char >= '0' && char <= '9') digits += char
    else if (!hasPoint && char === mark && digits.length > 0) {
      digits += '.'
      hasPoint = true
    }
  }

  const [whole = '', fraction] = digits.split('.')
  const integer = whole.replace(/^0+(?=\d)/, '')
  if (fraction === undefined) {
    return wholeUnit && integer === '0' ? '' : integer
  }
  return `${integer || '0'}.${fraction.slice(0, MONEY_PLACES)}`
}

/** Canonical text as the user should see it, grouped. Fraction left as typed. */
export const groupAmount = (canonical: string, locale: string): string => {
  if (canonical === '') return ''
  const [whole, fraction] = canonical.split('.')
  const grouped = Number(whole || '0').toLocaleString(locale, {
    maximumFractionDigits: 0,
  })
  return fraction === undefined
    ? grouped
    : `${grouped}${decimalMark(locale)}${fraction}`
}

/** Typed text to a number, or `undefined` when nothing usable was typed. */
export const parseAmount = (
  text: string,
  locale: string,
  wholeUnit: boolean,
): number | undefined => {
  const canonical = normalizeAmountInput(text, locale, wholeUnit)
  if (canonical === '' || canonical.endsWith('.')) return undefined
  const value = Number(canonical)
  return Number.isFinite(value) ? value : undefined
}

/** A stored number as text for the field to start from. */
export const toAmountInput = (
  value: number | null | undefined,
  locale: string,
): string =>
  value == null || !Number.isFinite(value)
    ? ''
    : groupAmount(String(value), locale)
