import { toAccount } from '@/modules/settings/api/accounts'
import type { WireAccount } from '@/types/catalog'

const wire = (kind: string): WireAccount =>
  ({
    id: 'source-tunai',
    name: 'Tunai',
    kind,
    opening_balance: 1500000,
    as_of: '2026-05-01',
    order: 0,
    archived_at: null,
    household_id: 'household-001',
  }) as WireAccount

describe('toAccount', () => {
  it.each([
    ['CASH', 'cash'],
    ['BANK', 'bank'],
    ['EWALLET', 'ewallet'],
  ])('maps the wire %s onto the domain %s', (sent, expected) => {
    expect(toAccount(wire(sent)).kind).toBe(expected)
  })

  // The cutover: until the API ships uppercase it still sends lowercase, and
  // an undefined `kind` renders an unselected radio group in Settings.
  it.each(['cash', 'bank', 'ewallet'])(
    'passes a lowercase %s through during the cutover',
    (sent) => {
      expect(toAccount(wire(sent)).kind).toBe(sent)
    },
  )

  it('leaves the rest of the row alone', () => {
    expect(toAccount(wire('CASH'))).toEqual({
      id: 'source-tunai',
      name: 'Tunai',
      kind: 'cash',
      openingBalance: 1500000,
      asOf: '2026-05-01',
      order: 0,
      archivedAt: null,
      householdId: 'household-001',
    })
  })
})
