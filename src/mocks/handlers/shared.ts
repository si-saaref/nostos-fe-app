import { HttpResponse, delay } from 'msw'

/**
 * Latency, so the loading states the app actually ships get seen during
 * development. Skipped under test, where a delay buys nothing and costs
 * wall-clock on every request.
 */
const IS_TEST = import.meta.env.MODE === 'test'

export const READ_LATENCY_MS = 150
export const WRITE_LATENCY_MS = 400

export const pause = (ms: number): Promise<void> =>
  IS_TEST ? Promise.resolve() : delay(ms)

/**
 * The documented envelope (auth PRD v3.1 §0), used by every failure path.
 * A bare `new HttpResponse(null, { status })` leaves `getErrorMessage` nothing
 * to read, so the UI falls back to axios's "Request failed with status code
 * 404" and no error copy is testable.
 */
export const errorBody = (status: number, code: string, message: string) =>
  HttpResponse.json(
    { success: false, status_code: status, error: { code, message } },
    { status },
  )

export const notFound = (what: string) =>
  errorBody(404, 'NOT_FOUND', `${what} not found`)
