import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import { entityKey } from '@/api/keys'
import { useInvalidatingMutation } from '@/api/useInvalidatingMutation'
import type { ApiEnvelope } from '@/types/api'
import type { Category, WireCategory } from '@/types/catalog'
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

export const toCategory = (row: WireCategory): Category => ({
  id: row.id,
  name: row.name,
  order: row.order,
  archivedAt: row.archived_at,
  householdId: row.household_id,
})

/**
 * Only the fields a caller actually passed reach the wire. Spreading a
 * partial through a fixed mapper would send `archived_at: undefined` on a
 * rename, and a server reading that as "clear the field" would silently
 * restore an archived category.
 */
const toCategoryBody = (patch: Partial<Category>) => {
  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.name = patch.name
  if (patch.order !== undefined) body.order = patch.order
  if (patch.archivedAt !== undefined) body.archived_at = patch.archivedAt
  return body
}

const fetchCategories = async (): Promise<Category[]> =>
  unwrap(
    await apiClient.get<ApiEnvelope<WireCategory[]>>('/expense-types'),
  ).map(toCategory)

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
    async (input: CategoryInput) =>
      toCategory(
        unwrap(
          await apiClient.post<ApiEnvelope<WireCategory>>('/expense-types', {
            name: input.name,
          }),
        ),
      ),
  )

export const useUpdateCategory = (householdId: string) =>
  useInvalidatingMutation(
    [categoryKeys.all(householdId)],
    async ({ id, ...patch }: { id: string } & Partial<Category>) =>
      toCategory(
        unwrap(
          await apiClient.patch<ApiEnvelope<WireCategory>>(
            `/expense-types/${id}`,
            toCategoryBody(patch),
          ),
        ),
      ),
  )
