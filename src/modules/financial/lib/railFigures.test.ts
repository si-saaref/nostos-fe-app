import { railCumulative, pageForDay } from './railFigures'
const daily = [
  {
    date: '2026-10-01',
    sum: 30000,
    sumText: '30000.00',
    count: 1,
    cumulative: 30000,
    cumulativeText: '30000.00',
  },
  {
    date: '2026-10-24',
    sum: 61185500,
    sumText: '61185500.00',
    count: 600,
    cumulative: 61215500,
    cumulativeText: '61215500.00',
  },
]
it('uses chronological BE cumulative independently of descending visual rows and page size', () => {
  expect(railCumulative(daily, '2026-10-01')).toBe('30000.00')
  expect(railCumulative(daily, '2026-10-24')).toBe('61215500.00')
  expect(railCumulative(undefined, '2026-10-24')).toBeUndefined()
})
it('locates a day beyond the loaded page without summing financial values', () => {
  expect(pageForDay(daily, '2026-10-01', 400)).toBe(2)
  expect(pageForDay(daily, '2026-10-24', 400)).toBe(1)
})
