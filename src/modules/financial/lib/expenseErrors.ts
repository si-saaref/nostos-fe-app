import { getErrorCode, getErrorMessage, getFieldErrors } from '@/utils/errors'
import type { CreateExpenseInput } from '@/types/expense'

/**
 * Turning a rejected create into errors the form can render on the field that
 * caused them.
 *
 * Two shapes reach here, because the API answers a bad reference differently
 * from a malformed body (BE `API-SPEC-DEVIATIONS.md` #1):
 *
 *   422 { error: { code: 'INVALID_TYPE', message } }         — no details[]
 *   400 { error: { code: 'VALIDATION_ERROR', details: [] } } — one row per field
 *
 * Anything unrecognised yields no entry, which is what routes it to the form's
 * summary line. Dropping it silently would be worse than a generic message.
 */
export type ExpenseField = keyof CreateExpenseInput

export interface ExpenseFieldError {
  field: ExpenseField
  message: string
}

/**
 * The 422 codes. There is no `details[]` on these, so the field comes from the
 * code — which is the entire reason this table exists.
 */
const FIELD_BY_CODE: Record<string, ExpenseField | undefined> = {
  INVALID_TYPE: 'typeId',
  INVALID_SOURCE: 'sourceId',
  INVALID_USER: 'paidByUserId',
}

/**
 * `details[].field` is the wire's name for the column. A lookup rather than a
 * snake→camel transform, for the reason `SORT_COLUMN` is one: a transform
 * happily "translates" `hosehold_id` into a field name and hands the form an
 * error it can never display.
 */
const FIELD_BY_WIRE_NAME: Record<string, ExpenseField | undefined> = {
  name: 'name',
  value: 'value',
  type_id: 'typeId',
  source_id: 'sourceId',
  date_paid: 'datePaid',
  paid_by_user_id: 'paidByUserId',
}

export const expenseFieldErrors = (error: unknown): ExpenseFieldError[] => {
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
