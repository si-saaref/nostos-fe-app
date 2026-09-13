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
 *
 * `details` is omitted when absent, not `null` — what the server does.
 */
export const errorBody = (
  status: number,
  code: string,
  message: string,
  details?: unknown,
) =>
  HttpResponse.json(
    {
      success: false,
      status_code: status,
      error: { code, message, ...(details !== undefined && { details }) },
    },
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

export interface WireTotalsBlock {
  sum: number
  count: number
  average: number
  moved?: number
  external_count?: number
  transfer_count?: number
}

export interface WireMeta {
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
  /** @deprecated Superseded by `summary` (BACKEND.md, the expenditure surface). */
  totals?: WireTotalsBlock
  summary?: {
    current: WireTotalsBlock
    /** Only when the request carried BOTH date bounds. */
    previous?: WireTotalsBlock
    /** Expenses only. Ranked `sum DESC, count DESC, id ASC`, capped at 5. */
    breakdown?: {
      by_type: Array<{ id: string; sum: number; count: number }>
      by_member: Array<{ id: string; sum: number; count: number }>
    }
  }
}

/**
 * The month before the one a request asked for, by the server's own two rules
 * (BACKEND.md): a whole calendar month shifts to the whole preceding calendar
 * month, and anything else shifts back by its own inclusive length in days.
 * `null` when the request did not carry both bounds — an unresolvable period
 * is an absent block, never a 400.
 */
export const previousPeriod = (
  from: string | null,
  to: string | null,
): { from: string; to: string } | null => {
  if (!from || !to) return null
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const day = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  const lastOfMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0)
  const isWholeMonth =
    start.getDate() === 1 &&
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear() &&
    end.getDate() === lastOfMonth.getDate()

  if (isWholeMonth) {
    return {
      from: day(new Date(start.getFullYear(), start.getMonth() - 1, 1)),
      to: day(new Date(start.getFullYear(), start.getMonth(), 0)),
    }
  }
  const span = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  const shift = (date: Date) =>
    day(new Date(date.getFullYear(), date.getMonth(), date.getDate() - span))
  return { from: shift(start), to: shift(end) }
}

/** A list page: rows in `data`, counts hoisted into `meta`. */
export const okPage = <T>(data: T[], meta: WireMeta) =>
  HttpResponse.json({ success: true, data, meta })
