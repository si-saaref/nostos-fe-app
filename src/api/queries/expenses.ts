import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { Expense, ExpenseFilters, Paginated } from '@/types/expense'

export const EXPENSE_KEYS = {
  all: ['expenses'] as const,
  byHousehold: (householdId: string) =>
    [...EXPENSE_KEYS.all, householdId] as const,
  list: (householdId: string, filters?: ExpenseFilters) =>
    [...EXPENSE_KEYS.byHousehold(householdId), 'list', filters ?? {}] as const,
  detail: (householdId: string, id: string) =>
    [...EXPENSE_KEYS.byHousehold(householdId), 'detail', id] as const,
}

export const useExpenses = (householdId: string, filters?: ExpenseFilters) =>
  useQuery({
    queryKey: EXPENSE_KEYS.list(householdId, filters),
    queryFn: async () => {
      const res = await apiClient.get<Paginated<Expense>>('/expenses', {
        params: filters,
      })
      return res.data
    },
    enabled: Boolean(householdId),
  })

export const useExpense = (householdId: string, id: string) =>
  useQuery({
    queryKey: EXPENSE_KEYS.detail(householdId, id),
    queryFn: async () => {
      const res = await apiClient.get<Expense>(`/expenses/${id}`)
      return res.data
    },
    enabled: Boolean(householdId && id),
  })
