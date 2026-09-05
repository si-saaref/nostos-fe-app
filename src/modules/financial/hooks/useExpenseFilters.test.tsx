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

const wrapperAt =
  (url: string) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )

describe('useExpenseFilters', () => {
  it('defaults page/limit/sort when the URL has no params', () => {
    const { result } = renderHook(() => useExpenseFilters('household-001'), {
      wrapper,
    })
    expect(result.current.filters.page).toBe(1)
    // The tape is continuous rather than paginated: one page holds a month.
    expect(result.current.filters.limit).toBe(400)
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

  // The URL is user-editable, so every value read from it is a claim, not a
  // fact. Before this, `?order=lol` was cast to 'asc' | 'desc' and forwarded.
  it('falls back to safe defaults for junk in the URL', () => {
    const { result } = renderHook(() => useExpenseFilters('household-001'), {
      wrapper: wrapperAt(
        '/financial/expenses?order=lol&limit=abc&page=-3&sortBy=drop',
      ),
    })
    expect(result.current.filters.sortOrder).toBe('desc')
    expect(result.current.filters.sortBy).toBe('datePaid')
    expect(result.current.filters.limit).toBe(400)
    expect(result.current.filters.page).toBe(1)
  })

  it('accepts the values it does support', () => {
    const { result } = renderHook(() => useExpenseFilters('household-001'), {
      wrapper: wrapperAt('/financial/expenses?order=asc&sortBy=value&limit=50'),
    })
    expect(result.current.filters.sortOrder).toBe('asc')
    expect(result.current.filters.sortBy).toBe('value')
    expect(result.current.filters.limit).toBe(50)
  })
})
