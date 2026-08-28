import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '@/test/test-utils'
import { useExpenseFilters } from '@/modules/financial/hooks/useExpenseFilters'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    <MemoryRouter initialEntries={['/financial/expenses']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
)

describe('useExpenseFilters', () => {
  it('defaults page/limit/sort when the URL has no params', () => {
    const { result } = renderHook(() => useExpenseFilters('household-001'), {
      wrapper,
    })
    expect(result.current.filters.page).toBe(1)
    expect(result.current.filters.limit).toBe(25)
    expect(result.current.filters.sortOrder).toBe('desc')
  })

  it('writes filters into the URL via updateFilters', () => {
    const seen: string[] = []
    const Probe = () => {
      const location = useLocation()
      seen.push(location.search)
      return null
    }
    const { result } = renderHook(() => useExpenseFilters('household-001'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter initialEntries={['/financial/expenses']}>
            {children}
            <Probe />
          </MemoryRouter>
        </QueryClientProvider>
      ),
    })

    act(() =>
      result.current.updateFilters({ typeId: 'type-groceries', page: 1 }),
    )

    expect(seen[seen.length - 1]).toContain('type=type-groceries')
  })
})
