import {
  fromIsoDay,
  isoDay,
  monthRange,
  previousMonthRange,
  shiftDays,
} from '@/utils/dates'

describe('isoDay', () => {
  it('reports the local day, not the UTC one', () => {
    // 00:30 local. `toISOString()` would report the previous day for anyone
    // east of UTC — which is the whole intended audience.
    const justAfterMidnight = new Date(2026, 7, 30, 0, 30, 0)
    expect(isoDay(justAfterMidnight)).toBe('2026-08-30')
  })

  it('pads single-digit months and days', () => {
    expect(isoDay(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('fromIsoDay', () => {
  it('round-trips with isoDay', () => {
    expect(isoDay(fromIsoDay('2026-02-01'))).toBe('2026-02-01')
  })

  it('parses as a local date rather than UTC midnight', () => {
    expect(fromIsoDay('2026-08-30').getDate()).toBe(30)
  })
})

describe('monthRange', () => {
  it('spans the whole month', () => {
    expect(monthRange(new Date(2026, 7, 15))).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    })
  })

  it('handles a short month', () => {
    expect(monthRange(new Date(2026, 1, 10))).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    })
  })

  it('crosses a year boundary going back', () => {
    expect(previousMonthRange(new Date(2026, 0, 15))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    })
  })
})

describe('shiftDays', () => {
  it('crosses a month boundary', () => {
    expect(isoDay(shiftDays(new Date(2026, 7, 30), 5))).toBe('2026-09-04')
  })

  it('goes backwards', () => {
    expect(isoDay(shiftDays(new Date(2026, 7, 2), -5))).toBe('2026-07-28')
  })
})
