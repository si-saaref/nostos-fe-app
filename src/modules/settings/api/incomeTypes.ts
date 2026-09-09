import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import { entityKey } from '@/api/keys'
import { useInvalidatingMutation } from '@/api/useInvalidatingMutation'
import type { ApiEnvelope } from '@/types/api'
import type { IncomeType, WireIncomeType } from '@/types/income'

/**
 * `/income-types` — one key, one type, one hook. See `categories.ts`.
 *
 * Settings writes these and the income form reads them, so both come through
 * here: two hooks over one URL is what makes a rename in Settings invisible on
 * the ledger.
 *
 * Simpler than a category — no colour, no order (PRD §5). An income type is
 * only ever a word the household chose, and its identity on screen travels on
 * the payment source's rim instead.
 */
export const incomeTypeKeys = {
  all: (householdId: string) => entityKey(householdId, 'incomeTypes'),
}

export const toIncomeType = (row: WireIncomeType): IncomeType => ({
  id: row.id,
  name: row.name,
  archivedAt: row.archived_at,
  householdId: row.household_id,
})

/** Only what the caller passed — see `toCategoryBody` for why. */
const toIncomeTypeBody = (patch: Partial<IncomeType>) => {
  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.name = patch.name
  if (patch.archivedAt !== undefined) body.archived_at = patch.archivedAt
  return body
}

const fetchIncomeTypes = async (): Promise<IncomeType[]> =>
  unwrap(
    await apiClient.get<ApiEnvelope<WireIncomeType[]>>('/income-types'),
  ).map(toIncomeType)

export const useIncomeTypes = (householdId: string) =>
  useQuery({
    queryKey: incomeTypeKeys.all(householdId),
    queryFn: fetchIncomeTypes,
    enabled: Boolean(householdId),
  })

export const useCreateIncomeType = (householdId: string) =>
  useInvalidatingMutation(
    [incomeTypeKeys.all(householdId)],
    async (input: { name: string }) =>
      toIncomeType(
        unwrap(
          await apiClient.post<ApiEnvelope<WireIncomeType>>('/income-types', {
            name: input.name,
          }),
        ),
      ),
  )

export const useUpdateIncomeType = (householdId: string) =>
  useInvalidatingMutation(
    [incomeTypeKeys.all(householdId)],
    async ({ id, ...patch }: { id: string } & Partial<IncomeType>) =>
      toIncomeType(
        unwrap(
          await apiClient.patch<ApiEnvelope<WireIncomeType>>(
            `/income-types/${id}`,
            toIncomeTypeBody(patch),
          ),
        ),
      ),
  )
