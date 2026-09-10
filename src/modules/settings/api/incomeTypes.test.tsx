import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@/test/test-utils'
import { resetMockState } from '@/mocks/db'
import { MOCK_ME } from '@/mocks/fixtures/household'
import { INCOME_TYPE_NAMES } from '@/mocks/fixtures/incomeTypes'
import { useCreateIncomeType } from '@/modules/settings/api/incomeTypes'
import { getErrorCode, getErrorMessage } from '@/utils/errors'

const HOUSEHOLD = MOCK_ME.household_id

beforeEach(() => {
  resetMockState()
})

describe('useCreateIncomeType', () => {
  // CONFLICT, not DUPLICATE_NAME: the latter is not in the API's error enum
  // and never was, so a branch keyed on it could never fire.
  it('answers 409 CONFLICT for a name that exists, ignoring case', async () => {
    const { result } = renderHook(() => useCreateIncomeType(HOUSEHOLD), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ name: INCOME_TYPE_NAMES[0].toUpperCase() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(getErrorCode(result.current.error)).toBe('CONFLICT')
    expect(getErrorMessage(result.current.error)).toMatch(/sudah ada/i)
  })
})
