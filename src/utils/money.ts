/**
 * Money is a decimal with at most two places (`API-SPEC-EXPENSE.md` §3.2,
 * decided 2026-09-05), stored `DECIMAL` and sent on the wire as a JSON number.
 *
 * This file briefly documented the opposite. The integer-minor-units
 * convention it described came from a stale copy of the spec — the decision
 * had already been taken the other way, and backend built to it: their
 * `API-SPEC-DEVIATIONS.md` #6 widened the column to cap at
 * 999,999,999,999.99, citing §3.2's own IDR argument. Two decimal places are
 * what the API accepts.
 *
 * Which makes JavaScript floats a hazard rather than a detail: `0.1 + 0.2` is
 * `0.30000000000000004`, and a month of 200 entries accumulates enough of that
 * to print a total which disagrees with the rows a member can add up
 * themselves. A ledger that cannot add up is worse than one that is missing, so
 * every derived figure goes through here.
 *
 * There is deliberately **no ceiling**. Backend's cap is twelve digits, far
 * above anything a client should refuse on the server's behalf (deviation #6
 * says the client ceiling can be dropped, and it has been).
 */

/** The smallest amount that can be recorded. Zero is not an expense. */
export const MONEY_MIN = 0.01

/** The `step` a number input needs before it will accept a fraction at all. */
export const MONEY_STEP = 0.01

/**
 * Round to two places, correcting for the float representation first.
 *
 * `Math.round(1.005 * 100)` is 100 rather than 101, because `1.005` is stored
 * as slightly less than itself. Nudging by an epsilon costs nothing at these
 * magnitudes and removes the whole class of one-cent errors.
 */
export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100

/** A total, rounded once at the end rather than at every addition. */
export const sumMoney = (values: number[]): number =>
  roundMoney(values.reduce((total, value) => total + value, 0))

/** The mean of a set, or `0` for an empty one — never `NaN`, never a divide by zero. */
export const averageMoney = (sum: number, count: number): number =>
  count > 0 ? roundMoney(sum / count) : 0

/**
 * Does this amount fit the column? Rejects a third decimal place, which the
 * server would otherwise truncate — a member typing `10.999` should be told,
 * not quietly charged `11.00`.
 *
 * No upper bound, per deviation #6. The lower bound stays: `0` and negatives
 * are not amounts, and the server rejects them too.
 */
export const isValidMoney = (value: number): boolean =>
  Number.isFinite(value) && value >= MONEY_MIN && roundMoney(value) === value
