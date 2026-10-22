/**
 * API money uses fixed two-place decimal text; individual amounts are bounded
 * by the backend DECIMAL(14,2) column. UI forms still hold numbers, so this
 * boundary rejects amounts it cannot serialize without rounding. Aggregate
 * helpers convert each input to integer cents before addition. Server totals
 * remain authoritative for paginated reports.
 */

/** The smallest amount that can be recorded. Zero is not an expense. */
export const MONEY_MIN = 0.01
export const MONEY_MAX = 999999999999.99

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

/** Parse a single display amount to integer cents before any aggregate math. */
const centsOf = (value: number): bigint => {
  if (!Number.isFinite(value)) throw new RangeError('Invalid money amount')
  return BigInt(value.toFixed(2).replace('.', ''))
}

/** Add rows in integer cents; summing binary floats can lose the last cent. */
export const sumMoney = (values: number[]): number =>
  Number(values.reduce((total, value) => total + centsOf(value), 0n)) / 100

/** The mean of a set, rounded to cents, or 0 for an empty one. */
export const averageMoney = (sum: number, count: number): number => {
  if (count <= 0) return 0
  const cents = centsOf(sum)
  const divisor = BigInt(count)
  const rounded =
    cents >= 0n
      ? (cents + divisor / 2n) / divisor
      : -((-cents + divisor / 2n) / divisor)
  return Number(rounded) / 100
}

/**
 * Does this amount fit the column? Rejects a third decimal place, which the
 * server would otherwise truncate — a member typing `10.999` should be told,
 * not quietly charged `11.00`.
 *
 * The upper bound matches DECIMAL(14,2). Zero and negatives are not
 * recordable transaction amounts.
 */
export const isValidMoney = (value: number): boolean =>
  Number.isFinite(value) &&
  value >= MONEY_MIN &&
  value <= MONEY_MAX &&
  roundMoney(value) === value

/** Decimal places the column holds. Two, per `API-SPEC-EXPENSE.md` §3.2. */
export const MONEY_PLACES = 2

/** The API carries fixed-scale decimal text so JSON never parses money as a float. */
export const fromWireMoney = (value: string): number => {
  if (!/^-?(0|[1-9]\d*)\.\d{2}$/.test(value)) {
    throw new Error('Invalid money value from API')
  }
  return Number(value)
}

/** Convert a validated nonnegative form amount to canonical decimal text. */
export const toWireSignedMoney = (value: number): string => {
  if (!Number.isFinite(value)) {
    throw new RangeError('Invalid money amount')
  }
  const text = value.toFixed(2)
  if (Number(text) !== value) throw new RangeError('Too many decimal places')
  return text
}

export const toWireMoney = (value: number): string => {
  if (value < 0 || value > MONEY_MAX)
    throw new RangeError('Invalid money amount')
  return toWireSignedMoney(value)
}
