import type { QueryClient } from '@tanstack/react-query'
import { entityKey } from '@/api/keys'

export const invalidateFinancial = (
  client: QueryClient,
  householdId: string,
  domain: 'expenses' | 'income',
) =>
  Promise.all([
    client.invalidateQueries({ queryKey: entityKey(householdId, domain) }),
    client.invalidateQueries({ queryKey: entityKey(householdId, 'positions') }),
  ])
