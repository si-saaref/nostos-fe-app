import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { Session } from '@/types/household'
import type { LoginInput } from '@/modules/auth/types/auth'

/** Not household-scoped: the session is what tells us which household to scope to. */
export const sessionKey = ['auth', 'session'] as const

export const useSession = () =>
  useQuery({
    queryKey: sessionKey,
    queryFn: async () => {
      const res = await apiClient.get<Session>('/auth/session')
      return res.data
    },
    staleTime: Infinity,
    retry: false,
  })

export const useLogin = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const res = await apiClient.post<Session>('/auth/login', input)
      return res.data
    },
    // Everything cached belongs to whoever was signed in a moment ago. Clearing
    // rather than invalidating is what stops one person's ledger from painting
    // for the next person on a shared device.
    onSuccess: () => {
      queryClient.clear()
    },
  })
}
