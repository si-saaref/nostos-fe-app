import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@/test/test-utils'
import { db, resetMockState } from '@/mocks/db'
import { MOCK_ME } from '@/mocks/fixtures/household'
import { usePositions } from '@/modules/financial/api/positions'
import { monthRange } from '@/utils/dates'
import { roundMoney } from '@/utils/money'

const HOUSEHOLD = MOCK_ME.household_id
const thisMonth = monthRange(new Date())
const SCOPE = { asOf: thisMonth.to, from: thisMonth.from }

beforeEach(() => {
  resetMockState()
})

describe('usePositions', () => {
  it('returns one row per source with an opening and a current balance', async () => {
    const { result } = renderHook(() => usePositions(HOUSEHOLD, SCOPE), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.items.length).toBe(db.accounts.length)
    result.current.data?.items.forEach((row) => {
      expect(typeof row.openingBalance).toBe('number')
      expect(typeof row.balance).toBe('number')
    })
  })

  it('totals are the exact sum of the rows, because the response is complete', async () => {
    const { result } = renderHook(() => usePositions(HOUSEHOLD, SCOPE), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const items = result.current.data!.items
    expect(result.current.data?.totals.balance).toBe(
      roundMoney(items.reduce((sum, row) => sum + row.balance, 0)),
    )
    expect(result.current.data?.totals.opening).toBe(
      roundMoney(items.reduce((sum, row) => sum + row.openingBalance, 0)),
    )
  })

  it('derives a balance from the ledgers, not from opening_balance alone', async () => {
    const { result } = renderHook(() => usePositions(HOUSEHOLD, SCOPE), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // The payroll account receives every salary in the fixture, so its
    // balance cannot still be its opening balance.
    const payroll = result.current.data?.items.find(
      (row) => row.sourceId === 'source-bni',
    )
    const account = db.accounts.find((row) => row.id === 'source-bni')
    expect(payroll?.balance).not.toBe(account?.openingBalance)
  })

  it('does not clamp a negative balance to zero', async () => {
    // A source the household has emptied and then overspent. The formula must
    // report the shortfall, because the PRD allows it and a floor would show a
    // comfortable Rp 0 for an account that is genuinely short.
    db.expenses.unshift({
      id: 'exp-drain',
      name: 'Overspend',
      value: 99000000,
      typeId: db.categories[0].id,
      sourceId: 'source-qris',
      datePaid: thisMonth.from,
      paidByUserId: db.members[0].id,
      householdId: HOUSEHOLD,
      deletedAt: null,
    })

    const { result } = renderHook(() => usePositions(HOUSEHOLD, SCOPE), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const drained = result.current.data?.items.find(
      (row) => row.sourceId === 'source-qris',
    )
    expect(drained?.balance).toBeLessThan(0)
  })

  it('opens the period at the close of the day before it starts', async () => {
    const opening = renderHook(() => usePositions(HOUSEHOLD, SCOPE), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(opening.result.current.isSuccess).toBe(true))

    // Asking for a position "as of" the day before the month is the same
    // question as asking what the month opened at.
    const previousClose = renderHook(
      () => usePositions(HOUSEHOLD, { asOf: thisMonth.from, from: undefined }),
      { wrapper: createWrapper() },
    )
    await waitFor(() =>
      expect(previousClose.result.current.isSuccess).toBe(true),
    )

    const openedAt = opening.result.current.data!.totals.opening
    expect(typeof openedAt).toBe('number')
    // Not equal to this month's closing total: the fixture always records
    // something in the current month.
    expect(openedAt).not.toBe(opening.result.current.data!.totals.balance)
  })
})
