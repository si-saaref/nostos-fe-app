/** ISO `YYYY-MM-DD` in local time — never `toISOString()`, which shifts the
 *  day backwards for anyone east of UTC, which is everyone here. */
export const isoDay = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const monthRange = (date: Date): { from: string; to: string } => {
  const from = new Date(date.getFullYear(), date.getMonth(), 1)
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { from: isoDay(from), to: isoDay(to) }
}

export const previousMonthRange = (date: Date): { from: string; to: string } =>
  monthRange(new Date(date.getFullYear(), date.getMonth() - 1, 1))

export const shiftDays = (date: Date, days: number): Date => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Parse `YYYY-MM-DD` as a local date, avoiding the UTC midnight trap. */
export const fromIsoDay = (iso: string): Date => {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}
