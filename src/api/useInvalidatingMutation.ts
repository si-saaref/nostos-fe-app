import { useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * A write plus the reads it makes stale.
 *
 * Keys are a list rather than a single value because one endpoint can feed more
 * than one query — inviting a member changes both the members list and the
 * "paid by" roster, and invalidating only the one the mutation happens to sit
 * next to is how a stale picker survives a whole session.
 *
 * Returns the mutation object untouched, so `error` and `isPending` stay
 * available to the caller: a write that can fail needs somewhere to say so.
 */
export const useInvalidatingMutation = <TInput, TResult>(
  keys: ReadonlyArray<readonly unknown[]>,
  run: (input: TInput) => Promise<TResult>,
) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await Promise.all(
        keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
    },
  })
}
