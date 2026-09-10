import {
  groupAmount,
  isWholeUnitCurrency,
  normalizeAmountInput,
  parseAmount,
  toAmountInput,
} from '@/utils/amount'

describe('isWholeUnitCurrency', () => {
  it('knows the rupiah has no sub-unit and the dollar has one', () => {
    expect(isWholeUnitCurrency('IDR')).toBe(true)
    expect(isWholeUnitCurrency('usd')).toBe(false)
  })
})

describe('normalizeAmountInput', () => {
  it('drops the grouping it was given back', () => {
    expect(normalizeAmountInput('1.000.000', 'id-ID', true)).toBe('1000000')
    expect(normalizeAmountInput('1,000,000', 'en-US', false)).toBe('1000000')
  })

  it('kills a leading zero in a whole-unit currency', () => {
    expect(normalizeAmountInput('0', 'id-ID', true)).toBe('')
    expect(normalizeAmountInput('0100', 'id-ID', true)).toBe('100')
  })

  it('keeps the zero a dollar fraction needs', () => {
    expect(normalizeAmountInput('0', 'en-US', false)).toBe('0')
    expect(normalizeAmountInput('0.75', 'en-US', false)).toBe('0.75')
  })

  it('takes the locale decimal mark and no other', () => {
    expect(normalizeAmountInput('12,50', 'id-ID', true)).toBe('12.50')
    expect(normalizeAmountInput('12.50', 'id-ID', true)).toBe('1250')
  })

  it('refuses a third decimal place', () => {
    expect(normalizeAmountInput('10.999', 'en-US', false)).toBe('10.99')
  })
})

describe('groupAmount', () => {
  it('groups the whole part in the locale', () => {
    expect(groupAmount('1000000', 'id-ID')).toBe('1.000.000')
    expect(groupAmount('1000000.5', 'en-US')).toBe('1,000,000.5')
  })

  it('passes an empty field through', () => {
    expect(groupAmount('', 'id-ID')).toBe('')
  })
})

describe('parseAmount', () => {
  it('reads a grouped figure back as a number', () => {
    expect(parseAmount('1.500.000', 'id-ID', true)).toBe(1500000)
    expect(parseAmount('1,500.25', 'en-US', false)).toBe(1500.25)
  })

  it('gives nothing for an empty or half-typed field', () => {
    expect(parseAmount('', 'id-ID', true)).toBeUndefined()
    expect(parseAmount('12,', 'id-ID', true)).toBeUndefined()
  })
})

describe('toAmountInput', () => {
  it('seeds the field from a stored number', () => {
    expect(toAmountInput(1500000, 'id-ID')).toBe('1.500.000')
  })

  it('leaves the field empty when there is no value', () => {
    expect(toAmountInput(undefined, 'id-ID')).toBe('')
    expect(toAmountInput(null, 'id-ID')).toBe('')
  })
})
