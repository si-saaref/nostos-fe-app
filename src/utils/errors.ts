import { AxiosError } from 'axios'
import type { ApiErrorBody } from '@/types/api'

/**
 * The real error envelope (auth PRD v3.1 §0):
 *
 *   { success, status_code, error: { code, message }, ... }
 *
 * so the message lives at `data.error.message`, not `data.message`. The flat
 * shape is still accepted as a fallback because some earlier mock endpoints
 * answer that way, but the envelope wins — its wording is often the whole
 * feature (the 409s on invite differ per case on purpose).
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined
    return body?.error?.message ?? body?.message ?? error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Something went wrong'
}

/** Error code from the same envelope, for callers that branch on it. */
export const getErrorCode = (error: unknown): string | undefined => {
  if (error instanceof AxiosError) {
    return (error.response?.data as ApiErrorBody | undefined)?.error?.code
  }
  return undefined
}
