import { getErrorCode, getErrorMessage, getFieldErrors } from '@/utils/errors'
import type { CreateIncomeInput } from '@/types/income'

/**
 * A rejected write, turned into errors the form can render on the field that
 * caused them. Two shapes reach here, as with expenses (BE
 * `API-SPEC-DEVIATIONS.md` #1):
 *
 *   422 { error: { code: 'INVALID_SOURCE', message } }      — no details[]
 *   400 { error: { code: 'VALIDATION_ERROR', details: [] } } — one row per field
 *
 * Anything unrecognised yields no entry, which routes it to the form's summary
 * line rather than being dropped.
 */
export type IncomeField = keyof CreateIncomeInput

export interface IncomeFieldError {
  field: IncomeField
  message: string
}

/**
 * The codes with no `details[]`, so the field comes from the code alone.
 *
 * Both source failures land on `toSourceId`, and that is a deliberate choice
 * rather than a shortcut: the destination is the required field, so it is the
 * one a member can always act on. `SAME_SOURCE` goes there too — the fix for
 * "these are the same" is to change where the money went, since where it came
 * from is what the member was actually recording.
 */
const FIELD_BY_CODE: Record<string, IncomeField | undefined> = {
  INVALID_SOURCE: 'toSourceId',
  SAME_SOURCE: 'toSourceId',
  INVALID_TYPE: 'type',
  FUTURE_DATE: 'date',
}

/** A lookup, not a snake→camel transform — see `expenseErrors.ts` for why. */
const FIELD_BY_WIRE_NAME: Record<string, IncomeField | undefined> = {
  name: 'name',
  amount: 'amount',
  type: 'type',
  from_source_id: 'fromSourceId',
  to_source_id: 'toSourceId',
  date: 'date',
}

export const incomeFieldErrors = (error: unknown): IncomeFieldError[] => {
  const rows = getFieldErrors(error)
  if (rows.length > 0) {
    return rows.flatMap((row) => {
      const field = FIELD_BY_WIRE_NAME[row.field]
      return field ? [{ field, message: row.message }] : []
    })
  }

  const field = FIELD_BY_CODE[getErrorCode(error) ?? '']
  return field ? [{ field, message: getErrorMessage(error) }] : []
}
