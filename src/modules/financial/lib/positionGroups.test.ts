import { describe, expect, it } from 'vitest'
import { groupPositionsByKind } from '@/modules/financial/lib/positionGroups'
import type { Account } from '@/types/catalog'
import type { Position } from '@/types/income'

const account = (
  id: string,
  kind: Account['kind'],
  order: number,
  archivedAt: string | null = null,
): Account => ({
  id,
  name: id.toUpperCase(),
  kind,
  openingBalance: 0,
  asOf: '2026-01-01',
  order,
  archivedAt,
  householdId: 'h1',
})

const position = (
  sourceId: string,
  balance: number,
  openingBalance = 0,
): Position => ({ sourceId, openingBalance, balance })

const ACCOUNTS = [
  account('bsi', 'bank', 0),
  account('bni', 'bank', 1),
  account('bca', 'bank', 2),
  account('shopeepay', 'ewallet', 3),
  account('gopay', 'ewallet', 4),
  account('tunai', 'cash', 5),
]

describe('groupPositionsByKind', () => {
  it('groups several sources of one kind under that kind', () => {
    const groups = groupPositionsByKind(
      [
        position('bsi', 5400000),
        position('bni', 7100000),
        position('bca', 580000),
        position('gopay', 30000),
        position('tunai', 1180000),
      ],
      ACCOUNTS,
    )

    const bank = groups.find((group) => group.kind === 'bank')
    expect(bank?.sources.map((source) => source.id)).toEqual([
      'bsi',
      'bni',
      'bca',
    ])
    expect(bank?.balance).toBe(13080000)
  })

  it('subtotals a kind that is collectively negative', () => {
    const groups = groupPositionsByKind(
      [position('shopeepay', 0), position('gopay', -30000)],
      ACCOUNTS,
    )
    const wallets = groups.find((group) => group.kind === 'ewallet')
    expect(wallets?.balance).toBe(-30000)
  })

  it('orders kinds bank, ewallet, cash, and sources by their own order', () => {
    const groups = groupPositionsByKind(
      [position('tunai', 1), position('gopay', 1), position('bni', 1)],
      ACCOUNTS,
    )
    expect(groups.map((group) => group.kind)).toEqual([
      'bank',
      'ewallet',
      'cash',
    ])
  })

  it('carries period movement as balance minus opening', () => {
    const groups = groupPositionsByKind(
      [position('bni', 7100000, 3000000)],
      ACCOUNTS,
    )
    expect(groups[0].sources[0].movement).toBe(4100000)
  })

  it('drops a position whose source is unknown rather than inventing a group', () => {
    const groups = groupPositionsByKind(
      [position('bni', 1), position('ghost-source', 999)],
      ACCOUNTS,
    )
    expect(groups.flatMap((group) => group.sources)).toHaveLength(1)
  })

  it('keeps an archived source that still holds money, and marks it', () => {
    const accounts = [...ACCOUNTS, account('old', 'bank', 6, '2026-02-01')]
    const groups = groupPositionsByKind([position('old', 250000)], accounts)
    const source = groups.flatMap((group) => group.sources)[0]

    expect(source.id).toBe('old')
    expect(source.isArchived).toBe(true)
  })
})
