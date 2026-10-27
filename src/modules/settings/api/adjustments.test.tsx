import { act, renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@/test/test-utils'
import { useReconcileAccount } from '@/modules/settings/api/adjustments'

describe('useReconcileAccount', () => {
  it('posts the target balance and returns authoritative balances', async () => {
    const { result } = renderHook(
      () => useReconcileAccount('household-001'),
      { wrapper: createWrapper() },
    )

    let reconciled: Awaited<ReturnType<typeof result.current.mutateAsync>>
    await act(async () => {
      reconciled = await result.current.mutateAsync({
        sourceId: 'source-tunai',
        targetBalance: 12500000,
        reason: 'Matched statement',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(reconciled!).toMatchObject({
      previousBalance: expect.any(Number),
      balance: 12500000,
      adjustment: { sourceId: 'source-tunai' },
    })
  })
})
