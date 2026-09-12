import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createTestQueryClient } from '@/test/test-utils'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { resetMockState } from '@/mocks/db'
import { MOCK_ME } from '@/mocks/fixtures/household'
import { useIncomeFilters } from '@/modules/financial/hooks/useIncomeFilters'
import { monthRange } from '@/utils/dates'

const HOUSEHOLD = MOCK_ME.household_id

const wrapperAt = (entry: string) => {
  const client = createTestQueryClient()
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <SettingsProvider>
        <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
      </SettingsProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  resetMockState()
})

describe('useIncomeFilters', () => {
  it('defaults to the current calendar month, written into the filters', async () => {
    const { result } = renderHook(() => useIncomeFilters(HOUSEHOLD), {
      wrapper: wrapperAt('/income'),
    })

    const thisMonth = monthRange(new Date())
    expect(result.current.filters.dateFrom).toBe(thisMonth.from)
    expect(result.current.filters.dateTo).toBe(thisMonth.to)
  })

  it('reads the month out of the URL so a shared link opens the same view', () => {
    const { result } = renderHook(() => useIncomeFilters(HOUSEHOLD), {
      wrapper: wrapperAt('/income?dateFrom=2026-03-01&dateTo=2026-03-31'),
    })

    expect(result.current.month.getFullYear()).toBe(2026)
    expect(result.current.month.getMonth()).toBe(2)
  })

  it('steps whole months and resets the page with them', async () => {
    const { result } = renderHook(() => useIncomeFilters(HOUSEHOLD), {
      wrapper: wrapperAt(
        '/income?dateFrom=2026-03-01&dateTo=2026-03-31&page=4',
      ),
    })

    act(() => result.current.stepMonth(-1))

    await waitFor(() => {
      expect(result.current.filters.dateFrom).toBe('2026-02-01')
      expect(result.current.filters.dateTo).toBe('2026-02-28')
      // Page 4 of March is not a place February has.
      expect(result.current.filters.page).toBe(1)
    })
  })

  it('cannot step past the month containing today', () => {
    const { result } = renderHook(() => useIncomeFilters(HOUSEHOLD), {
      wrapper: wrapperAt('/income'),
    })
    expect(result.current.canStepForward).toBe(false)
  })

  it('exposes the previous month, so the strip can compare against it', () => {
    const { result } = renderHook(() => useIncomeFilters(HOUSEHOLD), {
      wrapper: wrapperAt('/income?dateFrom=2026-03-01&dateTo=2026-03-31'),
    })
    expect(result.current.previousMonth.from).toBe('2026-02-01')
    expect(result.current.previousMonth.to).toBe('2026-02-28')
  })

  it('ignores a junk page in the URL rather than sending it', () => {
    const { result } = renderHook(() => useIncomeFilters(HOUSEHOLD), {
      wrapper: wrapperAt('/income?page=lol&limit=-3'),
    })
    expect(result.current.filters.page).toBe(1)
    expect(result.current.filters.limit).toBeGreaterThan(0)
  })

  it('asks for a whole month in one request', () => {
    const { result } = renderHook(() => useIncomeFilters(HOUSEHOLD), {
      wrapper: wrapperAt('/income'),
    })
    // The statement is continuous rather than paginated, and the strip's
    // derived figures are only shown when the page holds every row.
    expect(result.current.filters.limit).toBe(400)
  })
})
