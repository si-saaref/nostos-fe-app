/**
 * Money is `DECIMAL(10,2)` server-side and a JSON number on the wire, so every
 * amount carries at most two decimal places (PRD AC1.4).
 *
 * That makes JavaScript floats a hazard rather than a detail: `0.1 + 0.2` is
 * `0.30000000000000004`, and a month of 200 entries accumulates enough of that
 * to print a total which disagrees with the rows a member can add up
 * themselves. A ledger that cannot add up is worse than one that is missing, so
 * every derived figure goes through here.
 */

/** `DECIMAL(10,2)` — eight digits before the point, two after. */
export const MONEY_MAX = 99_999_999.99

/** The smallest amount that can be recorded. Zero is not an expense. */
export const MONEY_MIN = 0.01

export const MONEY_DECIMALS = 2

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
 * Does this amount fit the column? Rejects more than two decimal places, which
 * `DECIMAL(10,2)` would otherwise silently truncate — a member typing
 * `10.999` should be told, not quietly charged `11.00`.
 */
export const isValidMoney = (value: number): boolean =>
  Number.isFinite(value) &&
  value >= MONEY_MIN &&
  value <= MONEY_MAX &&
  roundMoney(value) === value
