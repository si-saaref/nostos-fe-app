import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { createTestQueryClient } from '@/test/test-utils'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { server } from '@/mocks/server'
import { entityKey } from '@/api/keys'
import { useReconcileAccount } from '@/modules/settings/api/adjustments'
import type { ReactNode } from 'react'

const setup = () => {
  const client = createTestQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return { client, wrapper }
}

describe('useReconcileAccount', () => {
  it('posts the target balance and returns authoritative balances', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(
      () => useReconcileAccount('household-001'),
      { wrapper },
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

  it('leaves adjustment and position caches unchanged when reconciliation fails', async () => {
    server.use(
      http.post('*/api/v1/payment-sources/:id/reconcile', () =>
        HttpResponse.json(
          { error: { code: 'NO_OP', message: 'Balance already matches' } },
          { status: 422 },
        ),
      ),
    )
    const { client, wrapper } = setup()
    const adjustmentKey = [...entityKey('household-001', 'adjustments'), 'source-tunai']
    const positionKey = entityKey('household-001', 'positions')
    const adjustments = [{ id: 'existing-adjustment' }]
    const positions = { total: 4500000 }
    client.setQueryData(adjustmentKey, adjustments)
    client.setQueryData(positionKey, positions)
    const { result } = renderHook(
      () => useReconcileAccount('household-001'),
      { wrapper },
    )

    await expect(
      result.current.mutateAsync({
        sourceId: 'source-tunai',
        targetBalance: 4500000,
        reason: 'Already counted',
      }),
    ).rejects.toBeDefined()

    expect(client.getQueryData(adjustmentKey)).toBe(adjustments)
    expect(client.getQueryData(positionKey)).toBe(positions)
  })
})
