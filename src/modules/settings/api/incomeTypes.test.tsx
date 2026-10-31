import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@/test/test-utils'
import { resetMockState } from '@/mocks/db'
import { server } from '@/mocks/server'
import { MOCK_ME } from '@/mocks/fixtures/household'
import { INCOME_TYPE_NAMES } from '@/mocks/fixtures/incomeTypes'
import {
  toIncomeType,
  useCreateIncomeType,
  useIncomeTypes,
} from '@/modules/settings/api/incomeCategories'
import type { WireIncomeType } from '@/types/income'
import { getErrorCode, getErrorMessage } from '@/utils/errors'

const HOUSEHOLD = MOCK_ME.household_id

beforeEach(() => {
  resetMockState()
})

describe('useCreateIncomeType', () => {
  it('reads through the preferred income-category alias', async () => {
    const seen: string[] = []
    const record = ({ request }: { request: Request }) =>
      seen.push(new URL(request.url).pathname)
    server.events.on('request:start', record)

    const { result } = renderHook(() => useIncomeTypes(HOUSEHOLD), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    server.events.removeListener('request:start', record)

    expect(seen.some((path) => path.endsWith('/income-categories'))).toBe(true)
  })

  it('maps semantic identity, order, and legacy fallbacks', () => {
    const row = {
      id: 'itype-salary',
      name: 'Payday',
      order: 0,
      system_key: 'SALARY',
      archived_at: null,
      household_id: HOUSEHOLD,
    } as WireIncomeType

    expect(toIncomeType(row)).toMatchObject({
      order: 0,
      systemKey: 'SALARY',
    })
    delete (row as Partial<WireIncomeType>).system_key
    expect(toIncomeType(row).systemKey).toBeNull()
  })

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
