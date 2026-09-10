import { MOCK_HOUSEHOLD } from '@/mocks/fixtures/household'
import type { Account } from '@/types/catalog'

/**
 * Six sources across three kinds, several of them sharing a kind — because a
 * household routinely holds three banks and two e-wallets, and a position
 * surface that only ever saw one source per kind would look finished and fall
 * over on the first real family.
 */
export const ACCOUNT_IDS = [
  'source-tunai',
  'source-qris',
  'source-debit',
  'source-ewallet',
  'source-bsi',
  'source-bni',
] as const

export const seedAccounts = (): Account[] => [
  {
    id: 'source-tunai',
    name: 'Tunai — kotak dapur',
    kind: 'cash',
    openingBalance: 4500000,
    asOf: '2026-05-01',
    order: 0,
    archivedAt: null,
    householdId: MOCK_HOUSEHOLD.id,
  },
  {
    id: 'source-qris',
    name: 'QRIS',
    kind: 'ewallet',
    openingBalance: 5500000,
    asOf: '2026-05-01',
    order: 1,
    archivedAt: null,
    householdId: MOCK_HOUSEHOLD.id,
  },
  {
    id: 'source-debit',
    name: 'Kartu debit BCA',
    kind: 'bank',
    openingBalance: 12400000,
    asOf: '2026-05-01',
    order: 2,
    archivedAt: null,
    householdId: MOCK_HOUSEHOLD.id,
  },
  {
    id: 'source-ewallet',
    name: 'GoPay',
    kind: 'ewallet',
    // Deliberately thin. Four months of small top-ups against steady spending
    // put this one under water, which is legal (income PRD §Risks) and is the
    // only way the negative-balance state gets exercised in development.
    openingBalance: 320000,
    asOf: '2026-05-01',
    order: 3,
    archivedAt: null,
    householdId: MOCK_HOUSEHOLD.id,
  },
  {
    id: 'source-bsi',
    name: 'BSI',
    kind: 'bank',
    openingBalance: 2100000,
    asOf: '2026-05-01',
    order: 4,
    archivedAt: null,
    householdId: MOCK_HOUSEHOLD.id,
  },
  {
    id: 'source-bni',
    name: 'BNI — payroll',
    kind: 'bank',
    openingBalance: 3000000,
    asOf: '2026-05-01',
    order: 5,
    archivedAt: null,
    householdId: MOCK_HOUSEHOLD.id,
  },
]
