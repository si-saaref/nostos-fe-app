import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { createWrapper } from '@/test/test-utils'
import { useExpenses } from '@/api/queries/expenses'

describe('useExpenses', () => {
  it('fetches the seeded expenses for a household', async () => {
    const { result } = renderHook(
      () =>
        useExpenses('household-001', {
          page: 1,
          limit: 25,
          sortBy: 'datePaid',
          sortOrder: 'desc',
        }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.items.length).toBeGreaterThan(0)
    expect(result.current.data?.items[0].householdId).toBe('household-001')
  })

  it('is disabled when householdId is empty', () => {
    const { result } = renderHook(() => useExpenses(''), {
      wrapper: createWrapper(),
    })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('surfaces server errors', async () => {
    server.use(
      http.get('/api/expenses', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    const { result } = renderHook(() => useExpenses('household-001'), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
