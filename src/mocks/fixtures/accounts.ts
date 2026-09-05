import { MOCK_HOUSEHOLD } from '@/mocks/fixtures/household'
import type { Account } from '@/types/catalog'

export const ACCOUNT_IDS = [
  'source-tunai',
  'source-qris',
  'source-debit',
  'source-ewallet',
] as const

export const seedAccounts = (): Account[] => [
  {
    id: 'source-tunai',
    name: 'Tunai — kotak dapur',
    kind: 'cash',
    openingBalance: 1500000,
    asOf: '2026-05-01',
    order: 0,
    archivedAt: null,
    householdId: MOCK_HOUSEHOLD.id,
  },
  {
    id: 'source-qris',
    name: 'QRIS',
    kind: 'ewallet',
    openingBalance: 750000,
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
    name: 'e-Wallet',
    kind: 'ewallet',
    openingBalance: 320000,
    asOf: '2026-05-01',
    order: 3,
    archivedAt: null,
    householdId: MOCK_HOUSEHOLD.id,
  },
]
