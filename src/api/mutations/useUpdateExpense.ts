import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { EXPENSE_KEYS } from '@/api/queries/expenses'
import type { Expense } from '@/types/expense'

interface UpdateExpenseArgs {
  id: string
  patch: Partial<Expense>
}

export const useUpdateExpense = (householdId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: UpdateExpenseArgs) => {
      const res = await apiClient.put<Expense>(`/expenses/${id}`, patch)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: EXPENSE_KEYS.byHousehold(householdId),
      })
    },
  })
}
