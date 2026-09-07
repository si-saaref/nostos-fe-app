import axios from 'axios'
import type { ApiErrorBody, ApiFieldError } from '@/types/api'

/** The response body, when there is one and it came from axios. */
const bodyOf = (error: unknown): ApiErrorBody | undefined =>
  axios.isAxiosError(error)
    ? (error.response?.data as ApiErrorBody | undefined)
    : undefined

/**
 * The real error envelope (auth PRD v3.1 §0):
 *
 *   { success, error: { code, message, status_code, details? }, ... }
 *
 * so the message lives at `data.error.message`, not `data.message`. The flat
 * shape is still accepted as a fallback because some earlier mock endpoints
 * answer that way, but the envelope wins — its wording is often the whole
 * feature (the 409s on invite differ per case on purpose).
 *
 * `axios.isAxiosError` rather than `instanceof AxiosError`: the guard keeps
 * working if axios is ever duplicated in the bundle graph.
 */
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const body = bodyOf(error)
    return body?.error?.message ?? body?.message ?? error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Something went wrong'
}

/**
 * The machine-readable half of the envelope. Clients branch on this, never on
 * the status: several codes share one status, and `INVALID_TYPE`,
 * `INVALID_SOURCE` and `INVALID_USER` all arrive as 422.
 */
export const getErrorCode = (error: unknown): string | undefined =>
  bodyOf(error)?.error?.code

/**
 * The per-case payload, from wherever the server put it.
 *
 * The API nests it at `error.details`. The flat fallback is not hedging: the
 * mock and the shipped signin path both used the flat shape until this change,
 * and a stale deployment of either would otherwise open the deletion modal
 * with no date in it — a modal whose only content is the date.
 *
 * `undefined` rather than `null` when empty, because that is what the server
 * sends: in production `details` is published only for `VALIDATION_ERROR` and
 * `HOUSEHOLD_DELETION_PENDING`, and omitted everywhere else.
 */
export const getErrorDetails = (error: unknown): unknown => {
  const body = bodyOf(error)
  return body?.error?.details ?? body?.details
}

const asFieldError = (value: unknown): ApiFieldError | null => {
  if (typeof value !== 'object' || value === null) return null
  const row = value as Partial<ApiFieldError>
  if (typeof row.field !== 'string' || typeof row.message !== 'string') {
    return null
  }
  // `code` is documented but not load-bearing here — the field and the message
  // are what reach the form. Defaulting it beats dropping a real field error
  // over a missing validator name.
  return { field: row.field, code: row.code ?? '', message: row.message }
}

/**
 * The `details[]` of a `400 VALIDATION_ERROR`, one entry per failed constraint.
 *
 * Empty for every other error, including `HOUSEHOLD_DELETION_PENDING` — which
 * puts an *object* in the same slot. Callers get `[]` rather than a runtime
 * error for guessing wrong.
 */
export const getFieldErrors = (error: unknown): ApiFieldError[] => {
  const details = getErrorDetails(error)
  if (!Array.isArray(details)) return []
  return details.flatMap((row) => {
    const parsed = asFieldError(row)
    return parsed ? [parsed] : []
  })
}

/**
 * The status, for the rare decision that turns on it. Branch on `error.code`
 * otherwise — the exception is a route that does not exist at all.
 */
export const getErrorStatus = (error: unknown): number | undefined =>
  axios.isAxiosError(error) ? error.response?.status : undefined
