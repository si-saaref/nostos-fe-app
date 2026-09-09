import { http } from 'msw'
import { db } from '@/mocks/db'
import { READ_LATENCY_MS, errorBody, ok, pause } from '@/mocks/handlers/shared'
import { roundMoney, sumMoney } from '@/utils/money'
import { fromIsoDay, isoDay, shiftDays } from '@/utils/dates'
import type { WirePosition } from '@/types/income'

/**
 * The endpoint the income surface waits on (`docs/SURFACE-INCOME.md` §7).
 *
 * It exists here rather than in the client because the answer needs the whole
 * history of two ledgers at once: a balance is `opening_balance ± income ∓
 * expense` from the source's `as_of` to a date, and no page of rows contains
 * that. A frontend that summed what it happened to have fetched would be
 * exactly right for a new household and quietly wrong for an old one.
 */
const balanceAt = (sourceId: string, upTo: string): number => {
  const account = db.accounts.find((row) => row.id === sourceId)
  if (!account) return 0
  // Rows before `as_of` are already inside the opening balance; counting them
  // again would double every rupiah recorded before the household started
  // using the app.
  const inWindow = (date: string) => date >= account.asOf && date <= upTo

  const into = sumMoney(
    db.income
      .filter(
        (row) =>
          row.deletedAt === null &&
          row.toSourceId === sourceId &&
          inWindow(row.date),
      )
      .map((row) => row.amount),
  )
  const outOf = sumMoney(
    db.income
      .filter(
        (row) =>
          row.deletedAt === null &&
          row.fromSourceId === sourceId &&
          inWindow(row.date),
      )
      .map((row) => row.amount),
  )
  const spent = sumMoney(
    db.expenses
      .filter(
        (row) =>
          row.deletedAt === null &&
          row.sourceId === sourceId &&
          inWindow(row.datePaid),
      )
      .map((row) => row.value),
  )

  // No clamp at zero. A source can genuinely go negative — the household
  // overspent an e-wallet, or is carrying a debt — and a floor would report a
  // comfortable Rp 0 for a source that is actually short (PRD §Risks).
  return roundMoney(account.openingBalance + into - outOf - spent)
}

export const positionHandlers = [
  http.get(
    '*/api/v1/households/:householdId/positions',
    async ({ request }) => {
      await pause(READ_LATENCY_MS)
      const params = new URL(request.url).searchParams
      const asOf = params.get('as_of') ?? isoDay(new Date())
      const from = params.get('from')

      if (Number.isNaN(fromIsoDay(asOf).getTime())) {
        return errorBody(400, 'VALIDATION_ERROR', 'as_of must be YYYY-MM-DD')
      }

      // The period opens at the close of the day before it starts, which is
      // what makes "opened September at" and "closed August at" the same
      // number rather than two figures a day apart.
      const openingAt = from ? isoDay(shiftDays(fromIsoDay(from), -1)) : asOf

      const rows: WirePosition[] = db.accounts
        .map((account) => ({
          source_id: account.id,
          opening_balance: balanceAt(account.id, openingAt),
          balance: balanceAt(account.id, asOf),
        }))
        // An archived source that still holds money is history with a balance,
        // and dropping it would make the household total disagree with its own
        // parts. An archived source at zero is just gone.
        .filter((row) => {
          const account = db.accounts.find((a) => a.id === row.source_id)
          return (
            account?.archivedAt === null ||
            row.balance !== 0 ||
            row.opening_balance !== 0
          )
        })

      // A complete collection, not a page: one row per source, so it is
      // shaped like `/payment-sources` rather than like a ledger list. That is
      // also why the totals are summed on the client — the client provably
      // holds every row, which is not true of any paginated aggregate.
      return ok(rows)
    },
  ),
]
