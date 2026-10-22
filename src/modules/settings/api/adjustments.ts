import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import { entityKey } from '@/api/keys'
import { fromWireMoney, toWireMoney } from '@/utils/money'
import type { ApiEnvelope } from '@/types/api'
import type { BalanceAdjustment, WireBalanceAdjustment } from '@/types/catalog'

export interface CreateAdjustmentInput {
  sourceId: string
  direction: 'INCREASE' | 'DECREASE'
  amount: number
  date: string
  reason: string
}

const key = (householdId: string, sourceId: string) =>
  [...entityKey(householdId, 'adjustments'), sourceId] as const

const toAdjustment = (row: WireBalanceAdjustment): BalanceAdjustment => ({
  id: row.id,
  householdId: row.household_id,
  sourceId: row.source_id,
  createdByUserId: row.created_by_user_id,
  delta: fromWireMoney(row.delta),
  date: row.date,
  reason: row.reason,
  createdAt: row.created_at,
})

export const useAdjustments = (
  householdId: string,
  sourceId: string,
  enabled: boolean,
) =>
  useQuery({
    queryKey: key(householdId, sourceId),
    queryFn: async () =>
      unwrap(
        await apiClient.get<ApiEnvelope<WireBalanceAdjustment[]>>(
          `/payment-sources/${sourceId}/adjustments`,
        ),
      ).map(toAdjustment),
    enabled: Boolean(householdId && sourceId) && enabled,
  })

export const useCreateAdjustment = (householdId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateAdjustmentInput) =>
      toAdjustment(
        unwrap(
          await apiClient.post<ApiEnvelope<WireBalanceAdjustment>>(
            `/payment-sources/${input.sourceId}/adjustments`,
            {
              direction: input.direction,
              amount: toWireMoney(input.amount),
              date: input.date,
              reason: input.reason.trim(),
            },
          ),
        ),
      ),
    onSuccess: (row) => {
      queryClient.invalidateQueries({
        queryKey: key(householdId, row.sourceId),
      })
      queryClient.invalidateQueries({
        queryKey: entityKey(householdId, 'positions'),
      })
    },
  })
}
