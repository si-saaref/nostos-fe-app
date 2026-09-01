import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '@/api/client'

/**
 * End this session.
 *
 * `clear()` rather than invalidate: everything cached belongs to whoever was
 * signed in a moment ago, and on a shared device the next person must not see
 * a frame of it. The navigation lives here so every caller is just a button.
 */
export const useLogout = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout')
    },
    onSuccess: () => {
      queryClient.clear()
      navigate('/signin', { replace: true })
    },
  })
}
