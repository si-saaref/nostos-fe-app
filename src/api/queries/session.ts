import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { Session } from '@/types/household'

export const SESSION_KEY = ['auth', 'session'] as const

export const useSession = () =>
  useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      const res = await apiClient.get<Session>('/auth/session')
      return res.data
    },
    staleTime: Infinity,
    retry: false,
  })
