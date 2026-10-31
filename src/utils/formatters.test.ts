import { formatCurrency, formatDate } from '@/utils/formatters'

describe('formatCurrency', () => {
  it('formats decimal text without losing a cent above JS safe integer cents', () => {
    expect(formatCurrency('99999999999999.99', 'USD', 'en-US')).toBe(
      '$99,999,999,999,999.99',
    )
  })

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
