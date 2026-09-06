/**
 * Money is an integer in minor units on the wire (`API-SPEC-FINANCIAL.md`
 * §3.2) — for IDR the minor unit is the rupiah itself, so `87000` is Rp 87.000.
 *
 * Summing is still routed through here rather than done inline. The values are
 * integers, but a total is a claim about the household's money, and having one
 * function own it means a currency whose minor unit is not the major one can
 * be handled in a single place rather than at every call site.
 *
 * There is no ceiling here any more: the column caps at 999,999,999,999.99
 * (BE `API-SPEC-DEVIATIONS.md` #6), far above anything a client should be
 * refusing on the server's behalf.
 */

/**
 * Round to two places, correcting for the float representation first.
 *
 * Kept for `sumMoney`'s benefit rather than for a two-decimal column:
 * `Math.round(1.005 * 100)` is 100 rather than 101, because `1.005` is stored
 * as slightly less than itself. Nudging by an epsilon costs nothing at these
 * magnitudes and removes the whole class of one-cent errors.
 */
export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100

/** A total, rounded once at the end rather than at every addition. */
export const sumMoney = (values: number[]): number =>
  roundMoney(values.reduce((total, value) => total + value, 0))
