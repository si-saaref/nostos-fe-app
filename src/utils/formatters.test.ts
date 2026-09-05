import { formatCurrency, formatDate } from '@/utils/formatters'

describe('formatCurrency', () => {
  it('formats rupiah with no decimals', () => {
    const result = formatCurrency(150000, 'IDR', 'id-ID')
    expect(result).toMatch(/^Rp/)
    expect(result).toContain('150')
    expect(result).not.toContain(',00')
  })

  it('honours the currency it is given', () => {
    expect(formatCurrency(1500, 'USD', 'en-US')).toBe('$1,500')
  })
})

describe('formatDate', () => {
  it('formats a YYYY-MM-DD string without timezone drift', () => {
    expect(formatDate('2026-01-15')).toBe('Jan 15, 2026')
  })
})
