import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import { entityKey } from '@/api/keys'
import { useInvalidatingMutation } from '@/api/useInvalidatingMutation'
import type { ApiEnvelope } from '@/types/api'
import type { Account, WireAccount } from '@/types/catalog'
import type { AccountInput } from '@/modules/settings/types/settings'

/** `/payment-sources` — one key, one type, one hook. See `categories.ts`. */
export const accountKeys = {
  all: (householdId: string) => entityKey(householdId, 'accounts'),
}

export const toAccount = (row: WireAccount): Account => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  openingBalance: row.opening_balance,
  asOf: row.as_of,
  order: row.order,
  archivedAt: row.archived_at,
  householdId: row.household_id,
})

/** Only what the caller passed — see `toCategoryBody` for why. */
const toAccountBody = (patch: Partial<Account>) => {
  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.name = patch.name
  if (patch.kind !== undefined) body.kind = patch.kind
  if (patch.openingBalance !== undefined) {
    body.opening_balance = patch.openingBalance
  }
  if (patch.asOf !== undefined) body.as_of = patch.asOf
  if (patch.order !== undefined) body.order = patch.order
  if (patch.archivedAt !== undefined) body.archived_at = patch.archivedAt
  return body
}

const fetchAccounts = async (): Promise<Account[]> =>
  unwrap(
    await apiClient.get<ApiEnvelope<WireAccount[]>>('/payment-sources'),
  ).map(toAccount)

export const useAccounts = (householdId: string) =>
  useQuery({
    queryKey: accountKeys.all(householdId),
    queryFn: fetchAccounts,
    enabled: Boolean(householdId),
  })

/** What a picker should offer: archived accounts are history, not choices. */
export const useActiveAccounts = (householdId: string) =>
  useQuery({
    queryKey: accountKeys.all(householdId),
    queryFn: fetchAccounts,
    enabled: Boolean(householdId),
    select: (accounts: Account[]) =>
      accounts.filter((account) => !account.archivedAt),
  })

export const useCreateAccount = (householdId: string) =>
  useInvalidatingMutation(
    [accountKeys.all(householdId)],
    async (input: AccountInput) =>
      toAccount(
        unwrap(
          await apiClient.post<ApiEnvelope<WireAccount>>('/payment-sources', {
            name: input.name,
            kind: input.kind,
            opening_balance: input.openingBalance,
            as_of: input.asOf,
          }),
        ),
      ),
  )

export const useUpdateAccount = (householdId: string) =>
  useInvalidatingMutation(
    [accountKeys.all(householdId)],
    async ({ id, ...patch }: { id: string } & Partial<Account>) =>
      toAccount(
        unwrap(
          await apiClient.patch<ApiEnvelope<WireAccount>>(
            `/payment-sources/${id}`,
            toAccountBody(patch),
          ),
        ),
      ),
  )
