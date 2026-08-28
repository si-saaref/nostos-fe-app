import { formatCurrency, formatDate } from '@/utils/formatters'

describe('formatCurrency', () => {
  it('formats an integer amount as a currency string', () => {
    const result = formatCurrency(150000)
    expect(typeof result).toBe('string')
    expect(result).toContain('150')
  })
})

describe('formatDate', () => {
  it('formats a YYYY-MM-DD string without timezone drift', () => {
    expect(formatDate('2026-01-15')).toBe('Jan 15, 2026')
  })
})
