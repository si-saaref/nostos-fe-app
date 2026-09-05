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

/**
 * The documented success envelope: `{ success, message?, data, meta? }`, where
 * `data` is always the resource itself and never a wrapper around it.
 *
 * These handlers used to answer the bare resource, which made the mock the one
 * backend in the world that did not wrap — so every reader was written one
 * level off and the mistake could not be caught until a real request was made.
 */
export const ok = <T>(data: T, init?: { status?: number; message?: string }) =>
  HttpResponse.json(
    { success: true, ...(init?.message && { message: init.message }), data },
    { status: init?.status ?? 200 },
  )

export interface WireMeta {
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
  totals?: { sum: number; count: number; average: number }
}

/** A list page: rows in `data`, counts hoisted into `meta`. */
export const okPage = <T>(data: T[], meta: WireMeta) =>
  HttpResponse.json({ success: true, data, meta })
