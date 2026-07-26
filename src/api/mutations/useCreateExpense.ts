import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { EXPENSE_KEYS } from '@/api/queries/expenses'
import type { CreateExpenseInput, Expense, Paginated } from '@/types/expense'

export const useCreateExpense = (householdId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      const res = await apiClient.post<Expense>('/expenses', input)
      return res.data
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: EXPENSE_KEYS.lists(householdId),
      })
      const previous = queryClient.getQueriesData<Paginated<Expense>>({
        queryKey: EXPENSE_KEYS.lists(householdId),
      })
      const optimistic: Expense = {
        id: `optimistic-${input.name}-${input.datePaid}`,
        householdId,
        ...input,
      }
      queryClient.setQueriesData<Paginated<Expense>>(
        { queryKey: EXPENSE_KEYS.lists(householdId) },
        (old) =>
          old
            ? {
                ...old,
                items: [optimistic, ...old.items],
                pagination: { ...old.pagination, total: old.pagination.total + 1 },
              }
            : old,
      )
      return { previous }
    },
    onError: (_error, _input, context) => {
      context?.previous?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: EXPENSE_KEYS.byHousehold(householdId),
      })
    },
  })
}
