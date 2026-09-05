import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '@/api/client'
import { meKey } from './me'

/**
 * End this session and return to signin, without reloading the document.
 *
 * The three lines below are ordered, and the order is not cosmetic:
 *
 * 1. Seed the session query with `null` — "definitively signed out". This
 *    notifies the observer inside `HouseholdProvider` *synchronously*, so
 *    `isAuthenticated` is false before anything navigates. Without it the
 *    provider kept rendering its last value, `PublicOnlyRoute` saw a live
 *    session on arrival and sent the user straight back to `/dashboard` —
 *    showing the departed session until `/auth/me` finally answered 401. On a
 *    shared device that is the exact frame logout exists to prevent. The same
 *    render re-runs `setHouseholdId('')`, clearing the module-scope tenant
 *    header with it.
 *
 * 2. *Then* `clear()` drops every cached query, because all of it belongs to
 *    whoever was signed in a moment ago. It does not notify the observers
 *    mounted on what it drops, which is a feature twice over: no dead refetch
 *    storm fires at a session the server has already destroyed, and the `null`
 *    from step 1 survives as the provider's rendered state.
 *
 *    Reversing these two silently does nothing. `clear()` orphans the existing
 *    observer, so a `setQueryData` after it creates a query nothing is
 *    listening to and the provider goes on serving the old session. Verified,
 *    not assumed.
 *
 * 3. Only now is navigating safe, because the guard already agrees.
 *
 * This used to be `window.location.assign('/signin')` — a full document load,
 * which papered over steps 1 and 2 by discarding the entire heap. It worked,
 * but it only worked because the session provider was mounted above the
 * router and had no other way to navigate. That is fixed (see
 * `routes/SessionBoundary.tsx`), so this is an ordinary navigation again.
 */
export const useLogout = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout')
    },
    onSuccess: () => {
      queryClient.setQueryData(meKey, null)
      queryClient.clear()
      navigate('/signin', { replace: true })
    },
  })
}
