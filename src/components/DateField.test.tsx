import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DateField } from '@/components/DateField'
import { renderWithProviders } from '@/test/test-utils'

describe('DateField', () => {
  it('distinguishes equal day numbers from adjacent months', async () => {
    const label = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' })
    renderWithProviders(
      <DateField
        label="Date"
        value="2026-10-27"
        max="2026-10-27"
        onChange={() => undefined}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Date' }))

    expect(
      screen.getByRole('button', { name: label.format(new Date(2026, 8, 30)) }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: label.format(new Date(2026, 9, 30)) }),
    ).toBeDisabled()
  })
})
