import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { createWrapper } from '@/test/test-utils'
import { useExpenses, useCreateExpense } from './expenses'
import { useIncome, useCreateIncome } from './income'
import { usePositions } from './positions'
import { db } from '@/mocks/db'

it.each(['expense', 'income', 'transfer'])(
  '%s refetches only after success',
  async (kind) => {
    let gets = 0
    let fail = true
    const record = ({ request }: { request: Request }) => {
      if (request.method === 'GET') gets++
    }
    server.events.on('request:start', record)
    const path = kind === 'expense' ? 'expenses' : 'income'
    server.use(
      http.post(`*/api/v1/${path}`, () =>
        fail
          ? HttpResponse.json(
              { success: false, error: { message: 'Rejected' } },
              { status: 422 },
            )
          : HttpResponse.json({
              success: true,
              data: [
                kind === 'expense'
                  ? {
                      id: 'new',
                      name: 'Test',
                      value: '10.00',
                      type_id: db.categories[0].id,
                      source_id: db.accounts[0].id,
                      date_paid: '2026-10-01',
                      paid_by_user_id: db.members[0].id,
                      household_id: 'household-001',
                    }
                  : {
                      id: 'new',
                      name: 'Test',
                      kind:
                        kind === 'transfer' ? 'TRANSFER' : 'EXTERNAL_INCOME',
                      amount: '10.00',
                      type_id: null,
                      from_source_id: null,
                      to_source_id: db.accounts[0].id,
                      date: '2026-10-01',
                      household_id: 'household-001',
                    },
              ],
            }),
      ),
    )
    const { result } = renderHook(
      () => ({
        expenses: useExpenses('household-001', {
          page: 1,
          limit: 20,
          sortBy: 'datePaid',
          sortOrder: 'desc',
        }),
        income: useIncome('household-001', { page: 1, limit: 20 }),
        positions: usePositions('household-001', {
          from: '2026-10-01',
          asOf: '2026-10-28',
        }),
        expense: useCreateExpense('household-001'),
        inflow: useCreateIncome('household-001'),
      }),
      { wrapper: createWrapper() },
    )
    try {
      await waitFor(() =>
        expect(
          result.current.positions.isSuccess &&
            result.current.expenses.isSuccess &&
            result.current.income.isSuccess,
        ).toBe(true),
      )
      const input =
        kind === 'expense'
          ? {
              name: 'Test',
              value: 10,
              typeId: db.categories[0].id,
              sourceId: db.accounts[0].id,
              datePaid: '2026-10-01',
              paidByUserId: db.members[0].id,
            }
          : {
              name: 'Test',
              kind:
                kind === 'transfer'
                  ? ('TRANSFER' as const)
                  : ('EXTERNAL_INCOME' as const),
              amount: 10,
              typeId: db.incomeTypes[0].id,
              fromSourceId: null,
              toSourceId: db.accounts[0].id,
              date: '2026-10-01',
            }
      const before = gets
      await act(async () => {
        await (
          kind === 'expense'
            ? result.current.expense.mutateAsync(
                input as Parameters<
                  typeof result.current.expense.mutateAsync
                >[0],
              )
            : result.current.inflow.mutateAsync(
                input as Parameters<
                  typeof result.current.inflow.mutateAsync
                >[0],
              )
        ).catch(() => {})
      })
      expect(gets).toBe(before)
      fail = false
      await act(async () => {
        await (kind === 'expense'
          ? result.current.expense.mutateAsync(
              input as Parameters<typeof result.current.expense.mutateAsync>[0],
            )
          : result.current.inflow.mutateAsync(
              input as Parameters<typeof result.current.inflow.mutateAsync>[0],
            ))
      })
      await waitFor(() => expect(gets).toBe(before + 2))
    } finally {
      server.events.removeListener('request:start', record)
    }
  },
)
