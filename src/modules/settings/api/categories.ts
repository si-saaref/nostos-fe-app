import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { entityKey } from '@/api/keys'
import { useInvalidatingMutation } from '@/api/useInvalidatingMutation'
import type { Category } from '@/types/catalog'
import type { CategoryInput } from '@/modules/settings/types/settings'

/**
 * `/expense-types` — one key, one type, one hook.
 *
 * Settings writes categories and Financial reads them, so both must come
 * through here. Two hooks over one URL is what made a rename in Settings
 * invisible on the expenses page: the mutation invalidated a key the ledger
 * never read.
 *
 * The list carries archived rows; `useActiveCategories` narrows with `select`
 * rather than a second request, so the picker and the settings list stay one
 * cache entry that cannot disagree with itself.
 */
export const categoryKeys = {
  all: (householdId: string) => entityKey(householdId, 'categories'),
}

const fetchCategories = async (): Promise<Category[]> =>
  (await apiClient.get<Category[]>('/expense-types')).data

export const useCategories = (householdId: string) =>
  useQuery({
    queryKey: categoryKeys.all(householdId),
    queryFn: fetchCategories,
    enabled: Boolean(householdId),
  })

/** What a picker should offer: archived categories are history, not choices. */
export const useActiveCategories = (householdId: string) =>
  useQuery({
    queryKey: categoryKeys.all(householdId),
    queryFn: fetchCategories,
    enabled: Boolean(householdId),
    select: (categories: Category[]) =>
      categories.filter((category) => !category.archivedAt),
  })

export const useCreateCategory = (householdId: string) =>
  useInvalidatingMutation(
    [categoryKeys.all(householdId)],
    (input: CategoryInput) =>
      apiClient.post<Category>('/expense-types', input).then((r) => r.data),
  )

export const useUpdateCategory = (householdId: string) =>
  useInvalidatingMutation(
    [categoryKeys.all(householdId)],
    ({ id, ...patch }: { id: string } & Partial<Category>) =>
      apiClient
        .put<Category>(`/expense-types/${id}`, patch)
        .then((r) => r.data),
  )
