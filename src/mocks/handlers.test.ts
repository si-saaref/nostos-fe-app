import { server } from '@/mocks/server'
import { http, HttpResponse } from 'msw'
import { apiClient } from '@/api/client'
import type { Expense, Paginated } from '@/types/expense'

describe('MSW expense handlers', () => {
  it('returns seeded expenses through apiClient', async () => {
    const res = await apiClient.get<Paginated<Expense>>('/expenses')
    expect(res.data.items.length).toBeGreaterThan(0)
    expect(res.data.items[0].householdId).toBe('household-001')
  })

  it('supports one-off handler overrides for error cases', async () => {
    server.use(
      http.get('/api/expenses', () =>
        HttpResponse.json({ message: 'Server error' }, { status: 500 }),
      ),
    )
    await expect(apiClient.get('/expenses')).rejects.toMatchObject({
      response: { status: 500 },
    })
  })
})
