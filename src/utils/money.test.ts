import {
  MONEY_MIN,
  averageMoney,
  isValidMoney,
  roundMoney,
  sumMoney,
} from '@/utils/money'
import { formatCurrency } from '@/utils/formatters'

describe('roundMoney', () => {
  it('rounds the float representation, not the number it prints as', () => {
    // Math.round(1.005 * 100) is 100, because 1.005 is stored as slightly less
    // than itself. This is the whole reason the helper exists.
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
  })

  it('leaves whole amounts alone', () => {
    expect(roundMoney(87000)).toBe(87000)
  })
})

describe('sumMoney', () => {
  it('rounds once at the end, so a long ledger still adds up', () => {
    // Summed naively this is 0.30000000000000004, and a month of rows drifts
    // far enough to print a total that disagrees with its own entries.
    expect(sumMoney([0.1, 0.2])).toBe(0.3)
    expect(sumMoney(Array(10).fill(0.1))).toBe(1)
  })

  it('is 0 for an empty set', () => {
    expect(sumMoney([])).toBe(0)
  })
})

describe('formatCurrency', () => {
  it('shows the fraction only when there is one', () => {
    // Forcing two places would print Rp 87.000,00 on every row of a month and
    // bury the digits that actually differ.
    expect(formatCurrency(87000, 'IDR', 'id-ID')).not.toMatch(/,00/)
    expect(formatCurrency(50000.5, 'IDR', 'id-ID')).toMatch(/,50/)
  })
})

describe('decimal support (restored 2026-09-06)', () => {
  it('accepts two decimal places — a split bill is a real amount', () => {
    // `min: 1` on the form, plus the deletion of this guard, silently made
    // 50000.50 unrecordable while the API accepted it.
    expect(isValidMoney(50000.5)).toBe(true)
    expect(isValidMoney(50000.55)).toBe(true)
    expect(isValidMoney(MONEY_MIN)).toBe(true)
  })

  it('rejects a third place rather than letting the server truncate it', () => {
    expect(isValidMoney(10.999)).toBe(false)
  })

  it('rejects zero and negatives', () => {
    expect(isValidMoney(0)).toBe(false)
    expect(isValidMoney(-5)).toBe(false)
    expect(isValidMoney(Number.NaN)).toBe(false)
  })

  it('has no ceiling — BE caps at twelve digits, not the client', () => {
    // Deviation #6 widened the column and said the client ceiling can go.
    expect(isValidMoney(999_999_999_999.99)).toBe(true)
  })

  it('averages at two places rather than truncating to whole units', () => {
    expect(averageMoney(10, 3)).toBe(3.33)
    expect(averageMoney(0, 0)).toBe(0)
  })
})
