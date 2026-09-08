import { AxiosError } from 'axios'
import { expenseFieldErrors } from '@/modules/financial/lib/expenseErrors'

const axiosError = (status: number, data?: unknown): AxiosError => {
  const error = new AxiosError('Request failed', 'ERR_BAD_RESPONSE')
  error.response = { status, data } as AxiosError['response']
  return error
}

/** The 422 shape: a code, a message, and deliberately no `details[]`. */
const coded = (code: string, message: string) =>
  axiosError(422, { success: false, error: { code, message } })

describe('expenseFieldErrors', () => {
  it.each([
    ['INVALID_TYPE', 'typeId'],
    ['INVALID_SOURCE', 'sourceId'],
    ['INVALID_USER', 'paidByUserId'],
  ])('maps %s onto %s with the server wording', (code, field) => {
    expect(expenseFieldErrors(coded(code, 'Tidak ditemukan'))).toEqual([
      { field, message: 'Tidak ditemukan' },
    ])
  })

  it('maps every details[] row of a VALIDATION_ERROR', () => {
    const error = axiosError(400, {
      error: {
        code: 'VALIDATION_ERROR',
        details: [
          { field: 'date_paid', code: 'IS_DATE_STRING', message: 'Bad date' },
          { field: 'paid_by_user_id', code: 'IS_UUID', message: 'Bad user' },
        ],
      },
    })
    expect(expenseFieldErrors(error)).toEqual([
      { field: 'datePaid', message: 'Bad date' },
      { field: 'paidByUserId', message: 'Bad user' },
    ])
  })

  // An unmapped error must reach the summary line rather than vanish.
  it('is empty for a code it does not know', () => {
    expect(expenseFieldErrors(coded('SOMETHING_NEW', 'Nope'))).toEqual([])
  })

  it('skips a details[] row naming a field the form does not have', () => {
    const error = axiosError(400, {
      error: {
        details: [
          { field: 'household_id', code: 'WHITELIST', message: 'Not allowed' },
          { field: 'name', code: 'IS_NOT_EMPTY', message: 'Required' },
        ],
      },
    })
    expect(expenseFieldErrors(error)).toEqual([
      { field: 'name', message: 'Required' },
    ])
  })

  it('is empty for a network error with no response', () => {
    expect(expenseFieldErrors(new Error('offline'))).toEqual([])
  })
})
