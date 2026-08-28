import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { SESSION_KEY } from '@/api/queries/session'
import type { Session } from '@/types/household'
import type { LoginInput } from '@/modules/auth/types/auth'

export const useLogin = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const res = await apiClient.post<Session>('/auth/login', input)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_KEY })
    },
  })
}
