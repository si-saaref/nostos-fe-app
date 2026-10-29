import type { ExpenseFilters } from '@/types/expense'
import { parseLedgerParams, serializeLedgerParams } from './ledgerSearchParams'
const defaults: ExpenseFilters = {
  dateFrom: '2026-10-01',
  dateTo: '2026-10-31',
  page: 1,
  limit: 400,
  sortBy: 'datePaid' as const,
  sortOrder: 'desc' as const,
}
it.each([
  [
    'dateFrom=2026-09-01&dateTo=2026-09-30&page=1&limit=400&sortBy=datePaid&order=desc',
    'month=2026-09',
  ],
  [
    'q=rice&type=food&source=cash&paidBy=me',
    'type=food&source=cash&paidBy=me&q=rice',
  ],
  [
    'dateFrom=2026-09-02&dateTo=2026-09-17',
    'dateFrom=2026-09-02&dateTo=2026-09-17',
  ],
  ['month=2026-10', ''],
  [
    'month=2026-09&page=2&limit=50&sortBy=value&order=asc',
    'month=2026-09&page=2&limit=50&sortBy=value&order=asc',
  ],
])('round trips legacy and meaningful links %s', (url, want) => {
  const parsed = parseLedgerParams(new URLSearchParams(url), defaults)
  expect(serializeLedgerParams(parsed, defaults).toString()).toBe(want)
  expect(
    parseLedgerParams(serializeLedgerParams(parsed, defaults), defaults),
  ).toEqual(parsed)
})
it('clears search and filters to the plain current-month route', () => {
  expect(
    serializeLedgerParams(
      { ...defaults, search: undefined, typeId: undefined },
      defaults,
    ).toString(),
  ).toBe('')
})
it('rejects invalid month and sort choices without changing API defaults', () => {
  expect(
    parseLedgerParams(
      new URLSearchParams('month=2026-13&order=drop&sortBy=oops&page=-1'),
      defaults,
    ),
  ).toMatchObject(defaults)
})
