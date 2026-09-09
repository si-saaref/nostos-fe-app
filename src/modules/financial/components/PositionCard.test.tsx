import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/test-utils'
import { PositionCard } from '@/modules/financial/components/PositionCard'
import type { PositionGroup } from '@/modules/financial/lib/positionGroups'
import type { AccountKind } from '@/types/catalog'

const source = (id: string, balance: number) => ({
  id,
  name: id,
  balance,
  openingBalance: balance,
  movement: 0,
  rim: 1 as const,
  isArchived: false,
})

const group = (kind: AccountKind, count: number): PositionGroup => ({
  kind,
  sources: Array.from({ length: count }, (_, i) =>
    source(`${kind}-${i}`, 1000),
  ),
  balance: count * 1000,
  openingBalance: count * 1000,
})

/** The kind grid, found by the cell that always sits inside it. */
const kindGrid = () =>
  screen
    .getByRole('region', { name: /posisi|position/i })
    .querySelector('.grid')

const props = {
  total: 3000,
  asOf: '2026-09-09',
  isLoading: false,
  isUnavailable: false,
}

describe('PositionCard layout', () => {
  // The class *is* the behaviour here: a fixed three tracks left a cash-only
  // household staring at two empty thirds of the card.
  it('gives a lone kind the whole card rather than a third of it', () => {
    renderWithProviders(<PositionCard {...props} groups={[group('cash', 2)]} />)

    expect(kindGrid()?.className).not.toMatch(/grid-cols-3/)
    expect(kindGrid()?.className).not.toMatch(/grid-cols-2/)
  })

  it('splits two kinds in half and three into thirds', () => {
    const { unmount } = renderWithProviders(
      <PositionCard {...props} groups={[group('bank', 1), group('cash', 1)]} />,
    )
    expect(kindGrid()?.className).toMatch(/sm:grid-cols-2/)
    expect(kindGrid()?.className).not.toMatch(/grid-cols-3/)
    unmount()

    renderWithProviders(
      <PositionCard
        {...props}
        groups={[group('bank', 1), group('ewallet', 1), group('cash', 1)]}
      />,
    )
    expect(kindGrid()?.className).toMatch(/lg:grid-cols-3/)
  })

  // Otherwise the row is a name hard left and a figure hard right, 1200px
  // apart, which is not a row anyone reads.
  it('columnises a lone kind’s sources instead of stretching each row', () => {
    renderWithProviders(<PositionCard {...props} groups={[group('cash', 3)]} />)

    const list = screen.getByRole('list')
    expect(list.className).toMatch(/lg:grid-cols-3/)
  })

  it('leaves sources in one column when kinds already share the width', () => {
    renderWithProviders(
      <PositionCard {...props} groups={[group('bank', 3), group('cash', 3)]} />,
    )

    screen.getAllByRole('list').forEach((list) => {
      expect(list.className).not.toMatch(/grid-cols-2|grid-cols-3/)
    })
  })
})
