import { useMutation } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import type { ApiEnvelope } from '@/types/api'

/**
 * Request a magic link.
 *
 * A plain mutation, not `useInvalidatingMutation`: this makes no cached read
 * stale. Nothing about the session changes until the link is clicked, which
 * happens in a different tab entirely.
 *
 * Mutations default to `retry: 0` in TanStack v5, which is what we want — the
 * API rations three links per address per hour, so a silent retry would spend
 * somebody's allowance.
 */
export const useRequestSigninLink = () =>
  useMutation({
    mutationFn: async (email: string) =>
      unwrap(
        await apiClient.post<ApiEnvelope<{ email: string }>>('/auth/signin', {
          email,
        }),
      ),
  })
