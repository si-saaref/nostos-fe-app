import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createTestQueryClient } from '@/test/test-utils'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { resetMockState } from '@/mocks/db'
import { MOCK_ME } from '@/mocks/fixtures/household'
import { useCalendarMonth } from '@/modules/financial/hooks/useCalendarMonth'
import { isoDay } from '@/utils/dates'

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

describe('useCalendarMonth', () => {
  it('defaults to the current month', () => {
    const { result } = renderHook(() => useCalendarMonth(HOUSEHOLD), {
      wrapper: wrapperAt('/calendar'),
    })

    const now = new Date()
    expect(result.current.month.getFullYear()).toBe(now.getFullYear())
    expect(result.current.month.getMonth()).toBe(now.getMonth())
  })

  it('reads the month out of the URL so a shared link opens the same view', () => {
    const { result } = renderHook(() => useCalendarMonth(HOUSEHOLD), {
      wrapper: wrapperAt('/calendar?month=2026-03'),
    })

    expect(result.current.month.getFullYear()).toBe(2026)
    expect(result.current.month.getMonth()).toBe(2)
  })

  it('opens on today when the month in view holds it', () => {
    const { result } = renderHook(() => useCalendarMonth(HOUSEHOLD), {
      wrapper: wrapperAt('/calendar'),
    })

    expect(result.current.selectedDate).toBe(isoDay(new Date()))
  })

  it('opens on nothing when the month in view is a past one', () => {
    const { result } = renderHook(() => useCalendarMonth(HOUSEHOLD), {
      wrapper: wrapperAt('/calendar?month=2026-03'),
    })

    // Landing on the 1st of March would be an arbitrary claim that the 1st is
    // the interesting day. Nothing is selected until someone picks a day.
    expect(result.current.selectedDate).toBeNull()
  })

  it('reads a selected day out of the URL, so a day is a link someone can hold', () => {
    const { result } = renderHook(() => useCalendarMonth(HOUSEHOLD), {
      wrapper: wrapperAt('/calendar?month=2026-03&day=2026-03-14'),
    })

    expect(result.current.selectedDate).toBe('2026-03-14')
  })

  it('ignores a selected day from outside the month in view', () => {
    const { result } = renderHook(() => useCalendarMonth(HOUSEHOLD), {
      wrapper: wrapperAt('/calendar?month=2026-03&day=2026-07-14'),
    })

    expect(result.current.selectedDate).toBeNull()
  })

  it('writes a picked day into the URL', async () => {
    const { result } = renderHook(() => useCalendarMonth(HOUSEHOLD), {
      wrapper: wrapperAt('/calendar?month=2026-03'),
    })

    act(() => result.current.selectDate('2026-03-09'))

    await waitFor(() => expect(result.current.selectedDate).toBe('2026-03-09'))
  })

  it('drops the selected day when the month steps away from it', async () => {
    const { result } = renderHook(() => useCalendarMonth(HOUSEHOLD), {
      wrapper: wrapperAt('/calendar?month=2026-03&day=2026-03-14'),
    })

    act(() => result.current.stepMonth(-1))

    await waitFor(() => expect(result.current.month.getMonth()).toBe(1))
    // The 14th of March is not a day February has.
    expect(result.current.selectedDate).toBeNull()
  })

  it('refuses to step past the current month', () => {
    const { result } = renderHook(() => useCalendarMonth(HOUSEHOLD), {
      wrapper: wrapperAt('/calendar'),
    })

    expect(result.current.canStepForward).toBe(false)
  })

  it('steps forward from a past month', () => {
    const { result } = renderHook(() => useCalendarMonth(HOUSEHOLD), {
      wrapper: wrapperAt('/calendar?month=2026-03'),
    })

    expect(result.current.canStepForward).toBe(true)
  })

  it('falls back to the current month when the URL carries nonsense', () => {
    const { result } = renderHook(() => useCalendarMonth(HOUSEHOLD), {
      wrapper: wrapperAt('/calendar?month=not-a-month'),
    })

    const now = new Date()
    expect(result.current.month.getMonth()).toBe(now.getMonth())
  })

  it('builds the month from both ledgers once they answer', async () => {
    const { result } = renderHook(() => useCalendarMonth(HOUSEHOLD), {
      wrapper: wrapperAt('/calendar'),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.calendar.days.length).toBeGreaterThan(27)
    expect(result.current.calendar.isComplete).toBe(true)
  })
})
