/**
 * Amounts carry up to two decimal places, but almost never do — IDR has no
 * circulating sub-unit, so a household's ledger is whole rupiah with the
 * occasional split bill.
 *
 * So the fraction is shown only when there is one. Forcing two places would
 * print `Rp 87.000,00` on every row of a month and bury the digits that differ;
 * dropping it entirely would round `50.000,50` to `50.001` and misreport what
 * was actually paid.
 */
export const formatCurrency = (
  value: number,
  currency = 'IDR',
  locale = 'id-ID',
): string => {
  const places = Number.isInteger(value) ? 0 : 2
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  }).format(value)
}

export const formatDate = (iso: string, locale = 'en-US'): string => {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  const date = new Date(year, (month ?? 1) - 1, day ?? 1)
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}
