import { render, screen } from '@testing-library/react'
import { StripShell } from '@/modules/financial/components/StripShell'

/**
 * The cells used to print `IDR 0` until the response landed — a claim about
 * the household's money standing in for a wait. `isNil` could not cover it:
 * that is a settled answer, and "not yet" is not one.
 */
describe('StripShell — loading', () => {
  it('shows no figure at all while one is on its way', () => {
    render(
      <StripShell
        label="Count"
        figures={[
          { id: 'total', key: 'Total spent', value: 'IDR 0', isLoading: true },
        ]}
      />,
    )
    expect(screen.getByText('Total spent')).toBeInTheDocument()
    expect(screen.queryByText('IDR 0')).toBeNull()
  })

  it('suppresses the note and sub-line with it, rather than half a cell', () => {
    render(
      <StripShell
        label="Count"
        figures={[
          {
            id: 'total',
            key: 'Total spent',
            value: 'IDR 0',
            note: '1 entry',
            sub: '0.4 per day',
            isLoading: true,
          },
        ]}
      />,
    )
    expect(screen.queryByText('1 entry')).toBeNull()
    expect(screen.queryByText('0.4 per day')).toBeNull()
  })

  it('prints the figure once it has arrived', () => {
    render(
      <StripShell
        label="Count"
        figures={[{ id: 'total', key: 'Total spent', value: 'IDR 59.635.000' }]}
      />,
    )
    expect(screen.getByText('IDR 59.635.000')).toBeInTheDocument()
  })
})
