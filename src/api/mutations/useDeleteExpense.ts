import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { EXPENSE_KEYS } from '@/api/queries/expenses'

export const useDeleteExpense = (householdId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/expenses/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: EXPENSE_KEYS.byHousehold(householdId),
      })
    },
  })
}
