import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@/test/test-utils'
import { useHouseholdPrefs } from '@/modules/settings/api/prefs'

describe('useHouseholdPrefs', () => {
  it('maps the household timezone from the live contract', async () => {
    const { result } = renderHook(
      () => useHouseholdPrefs('household-001'),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.timezone).toBe('Asia/Jakarta')
  })
})
