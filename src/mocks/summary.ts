import type { Comparison } from '@/types/api'
/** Mock server contract, computed on complete matching sets before pagination. */
export const comparisonFor = (
  current: string,
  previous: string | undefined,
): Comparison => {
  if (previous === undefined || Number(previous) === 0)
    return { percentage: null, direction: 'unavailable' }
  const percentage = (
    ((Number(current) - Number(previous)) / Number(previous)) *
    100
  ).toFixed(1)
  const rounded = Number(percentage)
  return {
    percentage: rounded === 0 ? '0.0' : percentage,
    direction: rounded === 0 ? 'flat' : rounded > 0 ? 'up' : 'down',
  }
}
