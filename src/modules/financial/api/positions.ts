import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import { entityKey } from '@/api/keys'
import { sumMoney } from '@/utils/money'
import type { ApiEnvelope } from '@/types/api'
import type { Positions, WirePosition } from '@/types/income'

/**
 * What each payment source holds — the one figure on the income surface that
 * the frontend cannot work out for itself.
 *
 * A balance is `opening_balance ± income ∓ expense` over the source's whole
 * history, so no page of rows contains the answer. Summing what the client
 * happened to fetch would be exactly right for a new household and quietly
 * wrong for an old one, which is the worst way for a money figure to fail.
 * The contract is in `docs/SURFACE-INCOME.md` §7.
 *
 * `isError` is a designed state, not an edge case: a balance the client cannot
 * compute must degrade to a stated sentence rather than a zero that reads as
 * "you have nothing".
 */
export interface PositionScope {
  /** The day the balance is true as of. */
  asOf: string
  /** First day of the period whose opening balance is wanted. Required by the route. */
  from: string
}

export const positionKeys = {
  all: (householdId: string) => entityKey(householdId, 'positions'),
  scoped: (householdId: string, scope: PositionScope) =>
    [...entityKey(householdId, 'positions'), scope] as const,
}

const toPosition = (row: WirePosition) => ({
  sourceId: row.source_id,
  openingBalance: row.opening_balance,
  balance: row.balance,
})

export const usePositions = (householdId: string, scope: PositionScope) =>
  useQuery({
    queryKey: positionKeys.scoped(householdId, scope),
    queryFn: async (): Promise<Positions> => {
      const rows = unwrap(
        await apiClient.get<ApiEnvelope<WirePosition[]>>('/positions', {
          params: { as_of: scope.asOf, from: scope.from },
        }),
      ).map(toPosition)

      // Summed here rather than read from `meta`, and this is the one
      // aggregate on the surface allowed to be: the response is a complete
      // collection — one row per source, never paginated — so the client
      // provably holds every term. Every *ledger* aggregate is guarded
      // against `pagination.total` for exactly the reason this one need not be.
      return {
        items: rows,
        totals: {
          opening: sumMoney(rows.map((row) => row.openingBalance)),
          balance: sumMoney(rows.map((row) => row.balance)),
        },
      }
    },
    enabled: Boolean(householdId),
    // One failed attempt is enough to know the route is missing. Retrying a
    // 404 three times only delays the honest message.
    retry: false,
  })
