import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { User } from '@/types/household'

export const USER_KEYS = {
  all: (householdId: string) => ['users', householdId] as const,
}

export const useUsers = (householdId: string) =>
  useQuery({
    queryKey: USER_KEYS.all(householdId),
    queryFn: async () => {
      const res = await apiClient.get<User[]>('/users')
      return res.data
    },
    enabled: Boolean(householdId),
  })
