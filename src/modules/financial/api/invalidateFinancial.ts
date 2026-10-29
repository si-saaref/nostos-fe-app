import type { QueryClient } from '@tanstack/react-query'
import { entityKey } from '@/api/keys'

export const invalidateFinancial = (
  client: QueryClient,
  householdId: string,
  domain: 'expenses' | 'income',
) =>
  Promise.all([
    client.invalidateQueries({ queryKey: entityKey(householdId, domain) }),
    ...(domain === 'income'
      ? ['expenses', 'categories'].map((entity) =>
          client.invalidateQueries({
            queryKey: entityKey(householdId, entity),
          }),
        )
      : []),
    client.invalidateQueries({ queryKey: entityKey(householdId, 'positions') }),
  ])
