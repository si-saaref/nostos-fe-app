import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { PaymentSource } from '@/types/expense'

export const PAYMENT_SOURCE_KEYS = {
  all: (householdId: string) => ['payment-sources', householdId] as const,
}

export const usePaymentSources = (householdId: string) =>
  useQuery({
    queryKey: PAYMENT_SOURCE_KEYS.all(householdId),
    queryFn: async () => {
      const res = await apiClient.get<PaymentSource[]>('/payment-sources')
      return res.data
    },
    enabled: Boolean(householdId),
    staleTime: Infinity,
  })
