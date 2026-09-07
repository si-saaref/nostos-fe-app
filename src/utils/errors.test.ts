import { AxiosError } from 'axios'
import {
  getErrorCode,
  getErrorDetails,
  getErrorMessage,
  getErrorStatus,
  getFieldErrors,
} from '@/utils/errors'

/** A real AxiosError — every reader guards on `axios.isAxiosError`. */
const axiosError = (status: number, data?: unknown): AxiosError => {
  const error = new AxiosError('Request failed', 'ERR_BAD_RESPONSE')
  error.response = { status, data } as AxiosError['response']
  return error
}

describe('getErrorCode', () => {
  it('reads the code from the envelope', () => {
    const error = axiosError(422, {
      success: false,
      error: { code: 'INVALID_TYPE', message: 'Unknown category' },
    })
    expect(getErrorCode(error)).toBe('INVALID_TYPE')
  })

  it('is undefined for a non-axios error', () => {
    expect(getErrorCode(new Error('boom'))).toBeUndefined()
  })

  it('is undefined when the body carries no error block', () => {
    expect(getErrorCode(axiosError(500, {}))).toBeUndefined()
  })
})

describe('getErrorDetails', () => {
  it('reads details nested under error — the shape the API sends', () => {
    const error = axiosError(403, {
      error: {
        code: 'HOUSEHOLD_DELETION_PENDING',
        details: { deletion_scheduled_for: '2026-09-26' },
      },
    })
    expect(getErrorDetails(error)).toEqual({
      deletion_scheduled_for: '2026-09-26',
    })
  })

  it('falls back to the flat shape, so a stale deployment still resolves', () => {
    const error = axiosError(403, {
      error: { code: 'HOUSEHOLD_DELETION_PENDING' },
      details: { deletion_scheduled_for: '2026-09-26' },
    })
    expect(getErrorDetails(error)).toEqual({
      deletion_scheduled_for: '2026-09-26',
    })
  })

  // Deviation #5: details is omitted, not null, when empty.
  it('is undefined when details is absent from both places', () => {
    expect(
      getErrorDetails(axiosError(422, { error: { code: 'X' } })),
    ).toBeUndefined()
  })
})

describe('getFieldErrors', () => {
  it('returns one entry per failed constraint', () => {
    const error = axiosError(400, {
      error: {
        code: 'VALIDATION_ERROR',
        details: [
          { field: 'date_paid', code: 'IS_DATE_STRING', message: 'Bad date' },
          { field: 'value', code: 'IS_POSITIVE', message: 'Must be positive' },
        ],
      },
    })
    expect(getFieldErrors(error)).toEqual([
      { field: 'date_paid', code: 'IS_DATE_STRING', message: 'Bad date' },
      { field: 'value', code: 'IS_POSITIVE', message: 'Must be positive' },
    ])
  })

  // HOUSEHOLD_DELETION_PENDING puts an object here, not an array.
  it('is empty when details is an object rather than an array', () => {
    const error = axiosError(403, {
      error: { details: { deletion_scheduled_for: '2026-09-26' } },
    })
    expect(getFieldErrors(error)).toEqual([])
  })

  it('is empty when details is absent', () => {
    expect(getFieldErrors(axiosError(422, { error: { code: 'X' } }))).toEqual(
      [],
    )
  })

  it('drops rows that are not field errors rather than passing them through', () => {
    const error = axiosError(400, {
      error: {
        details: ['just a string', { field: 'name', message: 'Required' }],
      },
    })
    expect(getFieldErrors(error)).toEqual([
      { field: 'name', code: '', message: 'Required' },
    ])
  })
})

describe('getErrorMessage', () => {
  it('still prefers the enveloped message', () => {
    const error = axiosError(409, { error: { message: 'Already a member' } })
    expect(getErrorMessage(error)).toBe('Already a member')
  })
})

describe('getErrorStatus', () => {
  it('reads the status off an axios error', () => {
    expect(getErrorStatus(axiosError(404))).toBe(404)
  })

  it('is undefined for anything that is not an axios error', () => {
    expect(getErrorStatus(new Error('boom'))).toBeUndefined()
    expect(getErrorStatus('nope')).toBeUndefined()
  })
})
