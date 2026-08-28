import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { ExpenseType } from '@/types/expense'

export const EXPENSE_TYPE_KEYS = {
  all: (householdId: string) => ['expense-types', householdId] as const,
}

export const useExpenseTypes = (householdId: string) =>
  useQuery({
    queryKey: EXPENSE_TYPE_KEYS.all(householdId),
    queryFn: async () => {
      const res = await apiClient.get<ExpenseType[]>('/expense-types')
      return res.data
    },
    enabled: Boolean(householdId),
    staleTime: Infinity,
  })
