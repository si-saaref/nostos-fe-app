import { householdDay } from './householdDay'
it('uses the household day when the browser is across midnight', () => {
  expect(householdDay(new Date('2026-10-27T18:30:00Z'), 'Asia/Jakarta')).toBe(
    '2026-10-28',
  )
  expect(
    householdDay(new Date('2026-10-27T18:30:00Z'), 'America/Los_Angeles'),
  ).toBe('2026-10-27')
})
