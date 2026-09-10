import { capitalizeFirst } from '@/utils/text'

describe('capitalizeFirst', () => {
  it('raises the first letter only', () => {
    expect(capitalizeFirst('tarik tunai')).toBe('Tarik tunai')
  })

  it('leaves an already-capitalised name alone', () => {
    expect(capitalizeFirst('BANK BSI')).toBe('BANK BSI')
  })

  it('survives an empty string', () => {
    expect(capitalizeFirst('')).toBe('')
  })
})
