import { apiClient } from '@/api/client'
import { db } from '@/mocks/db'
import { getErrorCode } from '@/utils/errors'

const cases = [
  {
    path: '/income',
    rows: () => db.income,
    body: () => ({
      name: 'Salary',
      kind: 'EXTERNAL_INCOME',
      description: null,
      amount: '1000000.25',
      type_id: db.incomeTypes[0].id,
      from_source_id: null,
      to_source_id: db.accounts[0].id,
      date: '2026-08-15',
    }),
  },
  {
    path: '/expenses',
    rows: () => db.expenses,
    body: () => ({
      name: 'Groceries',
      description: null,
      value: '25000.50',
      type_id: db.categories[0].id,
      source_id: db.accounts[0].id,
      date_paid: '2026-08-15',
      paid_by_user_id: db.members[0].id,
    }),
  },
]

describe.each(cases)('POST $path array contract', ({ path, rows, body }) => {
  it('creates multiple entries in one request and returns them in input order', async () => {
    const count = rows().length
    const payload = [body(), { ...body(), name: 'Second entry' }]
    const response = await apiClient.post(path, payload)

    expect(response.status).toBe(201)
    expect(response.data.data).toMatchObject(payload)
    expect(response.data.data).toHaveLength(2)
    expect(
      new Set(response.data.data.map((row: { id: string }) => row.id)).size,
    ).toBe(2)
    expect(rows()).toHaveLength(count + 2)
  })

  it('does not persist any entries when a later entry has an invalid reference', async () => {
    const before = [...rows()]
    const failure = await apiClient
      .post(path, [body(), { ...body(), type_id: 'missing-type' }])
      .catch((error: unknown) => error)

    expect(getErrorCode(failure)).toBe('INVALID_TYPE')
    expect(rows()).toEqual(before)
  })

  it.each([
    ['a direct object', () => body()],
    ['an empty array', () => []],
    ['null', () => null],
    ['a null item', () => [body(), null]],
    ['a nested array', () => [body(), []]],
    ['a primitive item', () => [body(), 'invalid']],
  ])('rejects %s without persisting entries', async (_label, payload) => {
    const before = [...rows()]
    const failure = await apiClient
      .post(path, payload())
      .catch((error: unknown) => error)

    expect(getErrorCode(failure)).toBe('VALIDATION_ERROR')
    expect(rows()).toEqual(before)
  })
})
