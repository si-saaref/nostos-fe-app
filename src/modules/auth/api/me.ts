import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import type { Me } from '@/types/household'
import type { ApiEnvelope } from '@/types/api'

/** Not household-scoped: this is what tells us which household to scope to. */
export const meKey = ['auth', 'me'] as const

/**
 * The session.
 *
 * `staleTime` is a minute rather than `Infinity` because the backend re-reads
 * the user on every request — this endpoint is the revocation signal, and
 * caching it forever is what would let a removed member keep browsing.
 */
export const useMe = () =>
  useQuery({
    queryKey: meKey,
    queryFn: async () =>
      unwrap(await apiClient.get<ApiEnvelope<Me>>('/auth/me')),
    staleTime: 60_000,
    retry: false,
  })
