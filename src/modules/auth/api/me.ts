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
 *
 * `Me | null` rather than `Me`, because the cache has to be able to hold
 * "definitively signed out" as a *value*. `undefined` means "not asked yet"
 * and an error means "the ask failed"; neither is something logout can assert
 * synchronously, and a guard that reads a stale session for even one render
 * bounces the user back into the app they just left. `useLogout` writes `null`
 * here for exactly that reason.
 */
export const useMe = () =>
  useQuery<Me | null>({
    queryKey: meKey,
    queryFn: async () =>
      unwrap(await apiClient.get<ApiEnvelope<Me>>('/auth/me')),
    staleTime: 60_000,
    retry: false,
  })
