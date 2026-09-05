import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'
import { authHandlers } from '@/mocks/handlers/auth'
import { SigninCard } from '@/modules/auth/signin/SigninCard'
import { LandingReason } from '@/modules/auth/types/auth'

const submit = async (email: string) => {
  await userEvent.type(screen.getByLabelText(/email/i), email)
  await userEvent.click(screen.getByRole('button', { name: /kirim tautan/i }))
}

describe('SigninCard', () => {
  // Auth is not registered by default — it runs against the real backend.
  beforeEach(() => server.use(...authHandlers))

  it('rejects a non-ASCII address without sending', async () => {
    renderWithProviders(<SigninCard landing={null} />)
    await submit('sari@café.com')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /format email tidak valid/i,
    )
    expect(screen.queryByText(/cek emailmu/i)).not.toBeInTheDocument()
  })

  it('replaces the form with the sent state and names the address', async () => {
    renderWithProviders(<SigninCard landing={null} />)
    await submit('sari@email.com')

    expect(await screen.findByText(/cek emailmu/i)).toBeInTheDocument()
    expect(screen.getByText(/sari@email\.com/)).toBeInTheDocument()
    // The form is gone, not merely hidden behind a toast.
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  })

  it('states the remaining resends', async () => {
    renderWithProviders(<SigninCard landing={null} />)
    await submit('sari@email.com')

    const resend = await screen.findByRole('button', { name: /kirim ulang/i })
    expect(resend).toHaveTextContent(/sisa 2/i)
  })

  it('stays on the sent screen while a resend is in flight', async () => {
    // Guards the latch: TanStack flips isSuccess back to false on re-mutate,
    // so a view keyed on it would flash the form back mid-resend.
    renderWithProviders(<SigninCard landing={null} />)
    await submit('sari@email.com')

    await userEvent.click(
      await screen.findByRole('button', { name: /kirim ulang/i }),
    )
    expect(screen.getByText(/cek emailmu/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  })

  it('returns to a clean form when the address was wrong', async () => {
    renderWithProviders(<SigninCard landing={null} />)
    await submit('sari@email.com')

    await userEvent.click(
      await screen.findByRole('button', { name: /ubah email/i }),
    )
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.queryByText(/cek emailmu/i)).not.toBeInTheDocument()
  })

  it('surfaces a 401 as a recoverable field error', async () => {
    renderWithProviders(<SigninCard landing={null} />)
    await submit('belum@email.com')

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/belum terdaftar/i),
    )
    // Still on the form, so the fix is one keystroke away.
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('surfaces a 429 as the rate-limit message', async () => {
    renderWithProviders(<SigninCard landing={null} />)
    await submit('limit@email.com')

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /terlalu banyak percobaan/i,
      ),
    )
  })

  it('explains why the visitor was bounced back here', () => {
    renderWithProviders(
      <SigninCard landing={{ reason: LandingReason.EXPIRED_LINK }} />,
    )
    expect(screen.getByText(/tautan sudah tidak berlaku/i)).toBeInTheDocument()
  })

  it('explains an address already active elsewhere', () => {
    renderWithProviders(
      <SigninCard landing={{ reason: LandingReason.ALREADY_IN_HOUSEHOLD }} />,
    )
    expect(
      screen.getByText(/sudah tergabung di rumah lain/i),
    ).toBeInTheDocument()
  })

  it('opens the deletion modal on a 403 instead of an inline error', async () => {
    renderWithProviders(<SigninCard landing={null} />)
    await submit('hapus@email.com')

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      /rumah ini sedang dihapus/i,
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('opens the deletion modal when the URL carries the grace deadline', () => {
    renderWithProviders(
      <SigninCard
        landing={{
          reason: LandingReason.DELETION_PENDING,
          until: '2026-09-26',
        }}
      />,
    )
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('returns focus to the email field when the modal is dismissed', async () => {
    // Radix restores focus to the trigger, and this modal has none — it opens
    // from a URL parameter. Without onCloseAutoFocus, focus lands on <body>
    // and a keyboard user restarts from the top of the document.
    renderWithProviders(
      <SigninCard
        landing={{
          reason: LandingReason.DELETION_PENDING,
          until: '2026-09-26',
        }}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /kembali/i }))

    await waitFor(() => expect(screen.getByLabelText(/email/i)).toHaveFocus())
  })
})
