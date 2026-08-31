import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { createTestQueryClient } from '@/test/test-utils'
import {
  useActiveCategories,
  useCategories,
  useUpdateCategory,
} from '@/modules/settings/api/categories'

const HOUSEHOLD_ID = 'household-001'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
)

/**
 * `/expense-types` used to be read through two keys — one for Settings, one for
 * the expense pickers — and only the Settings key was invalidated. These guard
 * the rule that replaced it: one endpoint, one key, one type.
 */
const setup = () =>
  renderHook(
    () => ({
      all: useCategories(HOUSEHOLD_ID),
      active: useActiveCategories(HOUSEHOLD_ID),
      update: useUpdateCategory(HOUSEHOLD_ID),
    }),
    { wrapper },
  )

describe('category cache', () => {
  it('reaches the picker when Settings renames a category', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.active.isSuccess).toBe(true))

    const target = result.current.all.data![0]
    expect(result.current.active.data?.[0].name).toBe(target.name)

    await act(async () => {
      await result.current.update.mutateAsync({
        id: target.id,
        name: 'Belanja harian',
      })
    })

    // The picker reads the same cache entry the mutation invalidated, so it
    // cannot be a session behind.
    await waitFor(() =>
      expect(result.current.active.data?.[0].name).toBe('Belanja harian'),
    )
  })

  it('keeps an archived category in the list, and out of the picker', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.all.isSuccess).toBe(true))

    const target = result.current.all.data![0]
    await act(async () => {
      await result.current.update.mutateAsync({
        id: target.id,
        archivedAt: '2026-08-30',
      })
    })

    // Still on the settings list — otherwise the Restore action it is supposed
    // to grow could never render.
    await waitFor(() =>
      expect(
        result.current.all.data?.find((row) => row.id === target.id)
          ?.archivedAt,
      ).toBe('2026-08-30'),
    )
    expect(
      result.current.active.data?.some((row) => row.id === target.id),
    ).toBe(false)
  })
})
