/**
 * Rim colours: the one visual channel that carries category identity.
 *
 * A rim is derived from a row's stable `order`, never from its position in a
 * fetched array — an archived row filtered out of one list and kept in another
 * would otherwise give the same category two different colours on two screens.
 */
export const RIM_COUNT = 8

export type RimIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export const rimFor = (order: number): RimIndex =>
  ((Math.abs(Math.trunc(order)) % RIM_COUNT) + 1) as RimIndex

/** Tailwind class per rim. One map, so no surface can drift to a shorter one. */
export const RIM_CLASS: Record<RimIndex, string> = {
  1: 'bg-rim-1',
  2: 'bg-rim-2',
  3: 'bg-rim-3',
  4: 'bg-rim-4',
  5: 'bg-rim-5',
  6: 'bg-rim-6',
  7: 'bg-rim-7',
  8: 'bg-rim-8',
}
