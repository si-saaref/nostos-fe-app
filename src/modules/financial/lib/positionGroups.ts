import { rimFor } from '@/theme/rims'
import { negateMoneyText, sumMoneyText } from '@/utils/money'
import type { RimIndex } from '@/theme/rims'
import type { Account, AccountKind } from '@/types/catalog'
import type { Position } from '@/types/income'

/**
 * Position, arranged the way it is read: kind first, then the sources inside it.
 *
 * A household routinely holds three banks and two e-wallets, so a flat list of
 * six balances answers "how much is in BNI" and never answers "how much is in
 * banks at all" — which is the question the subtotal exists for. Grouping is
 * therefore structure, not decoration.
 */
export interface PositionSource {
  id: string
  name: string
  balance: number
  balanceText?: string
  openingBalance: number
  openingBalanceText?: string
  /** What the period changed. Derived, so the endpoint stays two figures wide. */
  movement: number
  movementText?: string
  /** Source identity, from the row's stable `order` — never its array index. */
  rim: RimIndex
  /** History that still holds money. Kept, and said out loud. */
  isArchived: boolean
}

export interface PositionGroup {
  kind: AccountKind
  sources: PositionSource[]
  balance: number
  balanceText?: string
  openingBalance: number
  openingBalanceText?: string
}

/**
 * Biggest store of value first. Fixed rather than derived from the data: a
 * household whose cash happens to outweigh its banks this month should not get
 * a differently ordered page than it had last month.
 */
const KIND_ORDER: AccountKind[] = ['bank', 'ewallet', 'cash']

export const groupPositionsByKind = (
  positions: Position[],
  accounts: Account[],
): PositionGroup[] => {
  const byId = new Map(accounts.map((account) => [account.id, account]))

  const resolved = positions.flatMap((position): PositionSource[] => {
    const account = byId.get(position.sourceId)
    // A position for a source the catalogue does not know is not renderable:
    // it has no name, no kind and no rim. Dropping it is honest; inventing an
    // "Unknown" group would put a real balance under a fake label.
    if (!account) return []
    const movementText = sumMoneyText([
      position.balanceText ?? position.balance,
      negateMoneyText(
        position.openingBalanceText ?? position.openingBalance.toFixed(2),
      ),
    ])
    return [
      {
        id: account.id,
        name: account.name,
        balance: position.balance,
        balanceText: position.balanceText,
        openingBalance: position.openingBalance,
        openingBalanceText: position.openingBalanceText,
        movement: Number(movementText),
        movementText,
        rim: rimFor(account.order),
        isArchived: account.archivedAt !== null,
      },
    ]
  })

  const orderOf = (id: string) => byId.get(id)?.order ?? 0

  return KIND_ORDER.flatMap((kind): PositionGroup[] => {
    const sources = resolved
      .filter((source) => byId.get(source.id)?.kind === kind)
      .sort((a, b) => orderOf(a.id) - orderOf(b.id))
    if (sources.length === 0) return []
    const balanceText = sumMoneyText(
      sources.map((source) => source.balanceText ?? source.balance),
    )
    const openingBalanceText = sumMoneyText(
      sources.map(
        (source) => source.openingBalanceText ?? source.openingBalance,
      ),
    )
    return [
      {
        kind,
        sources,
        // Summed, never clamped: a kind can be collectively short, and a floor
        // at zero would make the kind subtotals disagree with the household
        // total they add up to.
        balance: Number(balanceText),
        balanceText,
        openingBalance: Number(openingBalanceText),
        openingBalanceText,
      },
    ]
  })
}
