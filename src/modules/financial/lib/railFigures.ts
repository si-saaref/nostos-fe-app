import type { DailySummary } from '@/types/api'
/** Values are canonical complete-range BE aggregates; missing never means zero. */
export const railCumulative = (
  daily: DailySummary[] | undefined,
  date: string | undefined,
) => daily?.find((day) => day.date === date)?.cumulativeText
export const pageForDay = (
  daily: DailySummary[],
  date: string,
  limit: number,
) => {
  const preceding = daily
    .filter((day) => day.date > date)
    .reduce((n, day) => n + day.count, 0)
  return Math.floor(preceding / limit) + 1
}
