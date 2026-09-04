import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { useNavigate } from 'react-router-dom'
import { meKey } from './me'

export const useLogout = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meKey })
      navigate('/signin', { replace: true })
    },
  })
}
