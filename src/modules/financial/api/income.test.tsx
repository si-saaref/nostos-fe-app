import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@/test/test-utils'
import { resetMockState } from '@/mocks/db'
import { MOCK_ME } from '@/mocks/fixtures/household'
import { INCOME_TYPE_NAMES } from '@/mocks/fixtures/incomeTypes'
import { ACCOUNT_IDS } from '@/mocks/fixtures/accounts'
import {
  toIncome,
  useCreateIncome,
  useDeleteIncome,
  useIncome,
  useUpdateIncome,
} from '@/modules/financial/api/income'
import { monthRange } from '@/utils/dates'
import type { WireIncome } from '@/types/income'

const HOUSEHOLD = MOCK_ME.household_id
const thisMonth = monthRange(new Date())
const FILTERS = { ...thisMonth, page: 1, limit: 400 }

beforeEach(() => {
  resetMockState()
})

describe('toIncome', () => {
  it('maps every snake_case key, keeping a null from_source_id null', () => {
    const wire: WireIncome = {
      id: 'inc-1',
      name: 'Salary Sep',
      amount: 5000000,
      type: 'salary',
      from_source_id: null,
      to_source_id: 'source-bni',
      date: '2026-09-04',
      household_id: HOUSEHOLD,
      created_by_user_id: 'user-1',
      updated_by_admin_id: null,
      created_at: '2026-09-04T02:00:00.000Z',
      updated_at: null,
    }

    expect(toIncome(wire)).toEqual({
      id: 'inc-1',
      name: 'Salary Sep',
      amount: 5000000,
      type: 'salary',
      fromSourceId: null,
      toSourceId: 'source-bni',
      date: '2026-09-04',
      householdId: HOUSEHOLD,
      createdByUserId: 'user-1',
      updatedByAdminId: null,
      createdAt: '2026-09-04T02:00:00.000Z',
      updatedAt: null,
    })
  })
})

describe('useIncome', () => {
  it('returns a page whose totals describe the whole filtered set', async () => {
    const { result } = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const page = result.current.data
    expect(page?.items.length).toBeGreaterThan(0)
    expect(page?.totals?.count).toBe(page?.pagination.total)
  })

  it('nets transfers out of the sum, so sum equals external inflow only', async () => {
    const { result } = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const items = result.current.data?.items ?? []
    const external = items
      .filter((row) => row.fromSourceId === null)
      .reduce((total, row) => total + row.amount, 0)

    expect(result.current.data?.totals?.sum).toBe(external)
  })

  it('orders newest first', async () => {
    const { result } = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const dates = (result.current.data?.items ?? []).map((row) => row.date)
    expect([...dates].sort().reverse()).toEqual(dates)
  })
})

describe('useCreateIncome', () => {
  it('creates an external inflow and stamps the recorder', async () => {
    const { result } = renderHook(() => useCreateIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      name: 'Salary Sep',
      amount: 5000000,
      type: INCOME_TYPE_NAMES[0],
      fromSourceId: null,
      toSourceId: ACCOUNT_IDS[0],
      date: thisMonth.from,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.fromSourceId).toBeNull()
    expect(result.current.data?.createdByUserId).toBeTruthy()
  })

  it('rejects a transfer whose two sources are the same', async () => {
    const { result } = renderHook(() => useCreateIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      name: 'Nowhere',
      amount: 1000,
      type: INCOME_TYPE_NAMES[0],
      fromSourceId: ACCOUNT_IDS[0],
      toSourceId: ACCOUNT_IDS[0],
      date: thisMonth.from,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('rejects a third decimal place rather than rounding it', async () => {
    const { result } = renderHook(() => useCreateIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      name: 'Odd',
      amount: 10.999,
      type: INCOME_TYPE_NAMES[0],
      fromSourceId: null,
      toSourceId: ACCOUNT_IDS[0],
      date: thisMonth.from,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useUpdateIncome', () => {
  it('clears from_source_id when the patch sends an explicit null', async () => {
    const list = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true))
    const transfer = list.result.current.data?.items.find(
      (row) => row.fromSourceId !== null,
    )
    expect(transfer).toBeDefined()

    const { result } = renderHook(() => useUpdateIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })
    result.current.mutate({ id: transfer!.id, fromSourceId: null })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.fromSourceId).toBeNull()
    expect(result.current.data?.updatedByAdminId).toBeTruthy()
  })

  it('leaves an absent field alone', async () => {
    const list = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true))
    const row = list.result.current.data!.items[0]

    const { result } = renderHook(() => useUpdateIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })
    result.current.mutate({ id: row.id, amount: 12345 })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.amount).toBe(12345)
    expect(result.current.data?.name).toBe(row.name)
  })
})

describe('useDeleteIncome', () => {
  it('soft-deletes: the row leaves the list and the totals drop it', async () => {
    const wrapper = createWrapper()
    const list = renderHook(() => useIncome(HOUSEHOLD, FILTERS), { wrapper })
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true))
    const before = list.result.current.data!
    const victim = before.items.find((row) => row.fromSourceId === null)!

    const { result } = renderHook(() => useDeleteIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })
    result.current.mutate(victim.id)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const after = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(after.result.current.isSuccess).toBe(true))

    expect(
      after.result.current.data?.items.some((row) => row.id === victim.id),
    ).toBe(false)
    expect(after.result.current.data?.totals?.sum).toBe(
      before.totals!.sum - victim.amount,
    )
  })

  it('answers 404 on a second delete of the same row', async () => {
    const list = renderHook(() => useIncome(HOUSEHOLD, FILTERS), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true))
    const id = list.result.current.data!.items[0].id

    const first = renderHook(() => useDeleteIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })
    first.result.current.mutate(id)
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))

    const second = renderHook(() => useDeleteIncome(HOUSEHOLD), {
      wrapper: createWrapper(),
    })
    second.result.current.mutate(id)
    await waitFor(() => expect(second.result.current.isError).toBe(true))
  })
})
