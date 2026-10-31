import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { createTestQueryClient } from '@/test/test-utils'
import { expenseKeys, useCreateExpense } from './expenses'
import { incomeKeys, useCreateIncome } from './income'

it.each(['expense', 'income'])(
  '%s does not duplicate a committed row already seen by a GET',
  async (kind) => {
    const client = createTestQueryClient()
    const hid = 'household-001'
    const key =
      kind === 'expense' ? expenseKeys.list(hid) : incomeKeys.list(hid)
    const common = {
      id: 'confirmed',
      name: 'Server name',
      householdId: hid,
      createdByUserId: 'user-001',
    }
    const row =
      kind === 'expense'
        ? {
            ...common,
            value: 11,
            typeId: 'type-makan',
            sourceId: 'source-tunai',
            paidByUserId: 'user-001',
            datePaid: '2026-10-01',
          }
        : {
            ...common,
            amount: 11,
            kind: 'EXTERNAL_INCOME',
            typeId: 'salary',
            fromSourceId: null,
            toSourceId: 'source-tunai',
            date: '2026-10-01',
          }
    const wire =
      kind === 'expense'
        ? {
            id: 'confirmed',
            name: 'Server name',
            value: '11.00',
            type_id: 'type-makan',
            source_id: 'source-tunai',
            paid_by_user_id: 'user-001',
            date_paid: '2026-10-01',
            household_id: hid,
            created_by_user_id: 'user-001',
          }
        : {
            id: 'confirmed',
            name: 'Server name',
            amount: '11.00',
            kind: 'EXTERNAL_INCOME',
            type_id: 'salary',
            from_source_id: null,
            to_source_id: 'source-tunai',
            date: '2026-10-01',
            household_id: hid,
            created_by_user_id: 'user-001',
          }
    server.use(
      http.post(
        `*/api/v1/${kind === 'expense' ? 'expenses' : 'income'}`,
        () => {
          // A concurrent list response has already observed the committed write.
          client.setQueryData(key, {
            items: [row],
            pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
            totals: { sum: 11, sumText: '11.00', count: 1, average: 11 },
          })
          return HttpResponse.json({ success: true, data: [wire] })
        },
      ),
    )
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(
      () => ({ expense: useCreateExpense(hid), income: useCreateIncome(hid) }),
      { wrapper },
    )
    await act(async () => {
      if (kind === 'expense')
        await result.current.expense.mutateAsync({
          name: 'Input name',
          value: 10,
          typeId: 'type-makan',
          sourceId: 'source-tunai',
          paidByUserId: 'user-001',
          datePaid: '2026-10-01',
        })
      else
        await result.current.income.mutateAsync({
          name: 'Input name',
          amount: 10,
          kind: 'EXTERNAL_INCOME',
          typeId: 'salary',
          fromSourceId: null,
          toSourceId: 'source-tunai',
          date: '2026-10-01',
        })
    })
    expect(client.getQueryData(key)).toMatchObject({
      items: [row],
      totals: { sum: 11, count: 1 },
      pagination: { total: 1 },
    })
  },
)

it.each(['expense', 'income'])(
  '%s does not retain outdated server summaries after a confirmed write',
  async (kind) => {
    const client = createTestQueryClient()
    const hid = 'household-001'
    const key =
      kind === 'expense' ? expenseKeys.list(hid) : incomeKeys.list(hid)
    client.setQueryData(key, {
      items: [],
      pagination: { page: 1, limit: 400, total: 0, totalPages: 1 },
      totals: { sum: 0, count: 0, average: 0 },
      summary: {
        current: { sum: 0, count: 0, average: 0 },
        comparison: { percentage: '0.0', direction: 'flat' },
        daily: [
          {
            date: '2026-10-01',
            sum: 0,
            sumText: '0.00',
            count: 0,
            cumulative: 0,
            cumulativeText: '0.00',
          },
        ],
      },
    })
    const { result } = renderHook(
      () => ({ expense: useCreateExpense(hid), income: useCreateIncome(hid) }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    )
    await act(async () => {
      if (kind === 'expense')
        await result.current.expense.mutateAsync({
          name: 'Lunch',
          value: 10,
          typeId: 'type-makan',
          sourceId: 'source-tunai',
          paidByUserId: 'user-001',
          datePaid: '2026-10-01',
        })
      else
        await result.current.income.mutateAsync({
          name: 'Gift',
          amount: 10,
          kind: 'EXTERNAL_INCOME',
          typeId: 'itype-0',
          fromSourceId: null,
          toSourceId: 'source-tunai',
          date: '2026-10-01',
        })
    })
    expect(
      client.getQueryData<{ summary?: unknown }>(key)?.summary,
    ).toBeUndefined()
  },
)
