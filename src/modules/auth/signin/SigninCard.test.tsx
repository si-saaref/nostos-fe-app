import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { SigninCard } from '@/modules/auth/signin/SigninCard'
import { resolveScene } from '@/modules/auth/signin/registry'

describe('SigninCard', () => {
  it('rejects a non-ASCII address without sending', async () => {
    renderWithProviders(<SigninCard landing={null} />)

    await userEvent.type(screen.getByLabelText(/email/i), 'sari@café.com')
    await userEvent.click(screen.getByRole('button', { name: /kirim tautan/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /format email tidak valid/i,
    )
    expect(screen.queryByText(/cek emailmu/i)).not.toBeInTheDocument()
  })

  it('replaces the form with the sent state and names the address', async () => {
    renderWithProviders(<SigninCard landing={null} />)

    await userEvent.type(screen.getByLabelText(/email/i), 'sari@email.com')
    await userEvent.click(screen.getByRole('button', { name: /kirim tautan/i }))

    expect(await screen.findByText(/cek emailmu/i)).toBeInTheDocument()
    expect(screen.getByText(/sari@email\.com/)).toBeInTheDocument()
    // The form is gone, not merely hidden behind a toast.
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  })

  it('states the remaining resends rather than letting the user hit the wall', async () => {
    renderWithProviders(<SigninCard landing={null} />)

    await userEvent.type(screen.getByLabelText(/email/i), 'sari@email.com')
    await userEvent.click(screen.getByRole('button', { name: /kirim tautan/i }))

    const resend = await screen.findByRole('button', { name: /kirim ulang/i })
    expect(resend).toHaveTextContent(/sisa 2/i)
  })

  it('surfaces a 401 as a recoverable field error', async () => {
    renderWithProviders(<SigninCard landing={null} />)

    // The slicing stub maps this address to "not invited".
    await userEvent.type(screen.getByLabelText(/email/i), 'belum@email.com')
    await userEvent.click(screen.getByRole('button', { name: /kirim tautan/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/belum terdaftar/i),
    )
    // Still on the form, so the fix is one keystroke away.
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('explains why the visitor was bounced back here', async () => {
    renderWithProviders(<SigninCard landing="expired_link" />)
    expect(screen.getByText(/tautan sudah tidak berlaku/i)).toBeInTheDocument()
  })
})

describe('scene resolution', () => {
  it('prefers an explicit ?scene= override', () => {
    expect(resolveScene('?scene=ledger', new Date(2026, 0, 15))).toBe('ledger')
  })

  it('follows the calendar once the rotation is switched on', () => {
    expect(resolveScene('', new Date(2026, 0, 15), true)).toBe('still-life')
    expect(resolveScene('', new Date(2026, 4, 15), true)).toBe('door')
    expect(resolveScene('', new Date(2026, 7, 15), true)).toBe('ledger')
  })

  it('ignores the calendar while the rotation is off', () => {
    // August maps to the ledger, but the rotation ships disabled.
    expect(resolveScene('', new Date(2026, 7, 15))).toBe('door')
  })

  it('falls back to the default for unscheduled months', () => {
    expect(resolveScene('', new Date(2026, 10, 15), true)).toBe('door')
  })

  it('ignores an unknown scene name', () => {
    expect(resolveScene('?scene=nope', new Date(2026, 10, 15))).toBe('door')
  })
})
