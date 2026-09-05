import { MOCK_HOUSEHOLD } from '@/mocks/fixtures/household'
import { isoDay } from '@/utils/dates'
import type { StoredExpense } from '@/types/expense'

/** Deterministic PRNG so the demo ledger — and every baseline derived from it
 *  — is identical on every reload and in every test run. */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

interface Recipe {
  name: string
  typeId: string
  sourceId: string
  /** Typical amount; actual values vary ±18% so a household "normal" exists. */
  base: number
  /** Rough chance of appearing on any given day. */
  chance: number
}

const RECIPES: Recipe[] = [
  {
    name: 'Sayur & buah pasar',
    typeId: 'type-belanja',
    sourceId: 'source-tunai',
    base: 87000,
    chance: 0.55,
  },
  {
    name: 'Beras 10 kg',
    typeId: 'type-belanja',
    sourceId: 'source-debit',
    base: 78000,
    chance: 0.12,
  },
  {
    name: 'Sabun & deterjen',
    typeId: 'type-belanja',
    sourceId: 'source-tunai',
    base: 64000,
    chance: 0.18,
  },
  {
    name: 'Gas LPG 12 kg',
    typeId: 'type-utilitas',
    sourceId: 'source-tunai',
    base: 78000,
    chance: 0.07,
  },
  {
    name: 'Token listrik',
    typeId: 'type-utilitas',
    sourceId: 'source-qris',
    base: 150000,
    chance: 0.09,
  },
  {
    name: 'Pulsa & data',
    typeId: 'type-utilitas',
    sourceId: 'source-ewallet',
    base: 120000,
    chance: 0.1,
  },
  {
    name: 'Ojek ke kantor',
    typeId: 'type-transport',
    sourceId: 'source-ewallet',
    base: 24000,
    chance: 0.5,
  },
  {
    name: 'Parkir & tol',
    typeId: 'type-transport',
    sourceId: 'source-tunai',
    base: 31000,
    chance: 0.3,
  },
  {
    name: 'Bensin',
    typeId: 'type-transport',
    sourceId: 'source-debit',
    base: 100000,
    chance: 0.14,
  },
  {
    name: 'Kopi & gorengan',
    typeId: 'type-makan',
    sourceId: 'source-tunai',
    base: 23000,
    chance: 0.6,
  },
  {
    name: 'Bakso malam',
    typeId: 'type-makan',
    sourceId: 'source-tunai',
    base: 54000,
    chance: 0.22,
  },
  {
    name: 'Nasi padang bungkus',
    typeId: 'type-makan',
    sourceId: 'source-qris',
    base: 74000,
    chance: 0.25,
  },
]

/** Entries that deliberately sit far outside their category's normal, so the
 *  "speaks only when abnormal" instrument has something true to report. */
const ANOMALIES: Array<{
  daysAgo: number
  name: string
  typeId: string
  sourceId: string
  value: number
  paidBy: string
}> = [
  {
    daysAgo: 1,
    name: 'Katering rapat RT',
    typeId: 'type-makan',
    sourceId: 'source-tunai',
    value: 310000,
    paidBy: 'user-003',
  },
  {
    daysAgo: 4,
    name: 'Token listrik',
    typeId: 'type-utilitas',
    sourceId: 'source-qris',
    value: 200000,
    paidBy: 'user-001',
  },
  {
    daysAgo: 12,
    name: 'Servis motor',
    typeId: 'type-transport',
    sourceId: 'source-debit',
    value: 465000,
    paidBy: 'user-001',
  },
  {
    daysAgo: 23,
    name: 'Belanja bulanan',
    typeId: 'type-belanja',
    sourceId: 'source-debit',
    value: 812000,
    paidBy: 'user-002',
  },
]

const DAYS_OF_HISTORY = 120

export const seedExpenses = (payerIds: string[]): StoredExpense[] => {
  const random = mulberry32(20260828)
  const today = new Date()
  // Anchored at noon so a day never straddles a boundary while being formatted.
  today.setHours(12, 0, 0, 0)
  const rows: StoredExpense[] = []
  let seq = 0

  for (let daysAgo = DAYS_OF_HISTORY; daysAgo >= 0; daysAgo -= 1) {
    const day = new Date(today)
    day.setDate(today.getDate() - daysAgo)
    const datePaid = isoDay(day)

    RECIPES.forEach((recipe) => {
      if (random() > recipe.chance) return
      const drift = 0.82 + random() * 0.36
      const value = Math.round((recipe.base * drift) / 500) * 500
      const payer = payerIds[Math.floor(random() * payerIds.length)]
      const recorder = payerIds[Math.floor(random() * payerIds.length)]
      seq += 1
      rows.push({
        id: `exp-${String(seq).padStart(4, '0')}`,
        name: recipe.name,
        value,
        typeId: recipe.typeId,
        sourceId: recipe.sourceId,
        datePaid,
        paidByUserId: payer,
        createdByUserId: recorder,
        householdId: MOCK_HOUSEHOLD.id,
        createdAt: `${datePaid}T${String(9 + Math.floor(random() * 11)).padStart(2, '0')}:${String(Math.floor(random() * 60)).padStart(2, '0')}:00Z`,
        updatedByAdminId: null,
        updatedAt: null,
        deletedAt: null,
      })
    })
  }

  ANOMALIES.forEach((anomaly, index) => {
    const day = new Date(today)
    day.setDate(today.getDate() - anomaly.daysAgo)
    const datePaid = isoDay(day)
    rows.push({
      id: `exp-odd-${index + 1}`,
      name: anomaly.name,
      value: anomaly.value,
      typeId: anomaly.typeId,
      sourceId: anomaly.sourceId,
      datePaid,
      paidByUserId: anomaly.paidBy,
      createdByUserId: anomaly.paidBy,
      householdId: MOCK_HOUSEHOLD.id,
      createdAt: `${datePaid}T20:14:00Z`,
      // The one edited row, so the admin audit stamp has a value somewhere.
      updatedByAdminId: index === 1 ? 'user-001' : null,
      updatedAt: index === 1 ? `${datePaid}T08:10:00Z` : null,
      deletedAt: null,
    })
  })

  // Newest first — the tape's order, and the order a member expects right
  // after recording something on their phone.
  return rows.sort((a, b) => b.datePaid.localeCompare(a.datePaid))
}
