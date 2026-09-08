import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import { entityKey } from '@/api/keys'
import { useInvalidatingMutation } from '@/api/useInvalidatingMutation'
import type { ApiEnvelope } from '@/types/api'
import type {
  Account,
  AccountKind,
  WireAccount,
  WireAccountKind,
} from '@/types/catalog'
import type { AccountInput } from '@/modules/settings/types/settings'

/** `/payment-sources` — one key, one type, one hook. See `categories.ts`. */
export const accountKeys = {
  all: (householdId: string) => entityKey(householdId, 'accounts'),
}

/**
 * `kind` is the one field whose casing differs across the wire. Two records
 * rather than `toLowerCase()`, for the reason `SORT_COLUMN` is a record: a
 * cast would let a value the union does not contain reach the radio group,
 * which then renders with nothing selected and no error anywhere.
 *
 * Inbound falls back to its input: until the API ships uppercase it still
 * sends lowercase, and a `kind` of `undefined` is exactly that unselected
 * group. Outbound needs no fallback — the domain union is closed.
 */
const KIND_FROM_WIRE: Record<string, AccountKind | undefined> = {
  CASH: 'cash',
  BANK: 'bank',
  EWALLET: 'ewallet',
}

const KIND_TO_WIRE: Record<AccountKind, WireAccountKind> = {
  cash: 'CASH',
  bank: 'BANK',
  ewallet: 'EWALLET',
}

const toDomainKind = (kind: string): AccountKind =>
  KIND_FROM_WIRE[kind] ?? (kind as AccountKind)

export const toAccount = (row: WireAccount): Account => ({
  id: row.id,
  name: row.name,
  kind: toDomainKind(row.kind),
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
  if (patch.kind !== undefined) body.kind = KIND_TO_WIRE[patch.kind]
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
            kind: KIND_TO_WIRE[input.kind],
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
