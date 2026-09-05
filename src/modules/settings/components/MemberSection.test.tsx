import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { MemberSection } from '@/modules/settings/components/MemberSection'

const setup = (props: Partial<Parameters<typeof MemberSection>[0]> = {}) =>
  renderWithProviders(
    <MemberSection
      householdId="household-001"
      householdName="Keluarga Adios"
      canManage
      currentUserId="user-001"
      {...props}
    />,
  )

describe('MemberSection', () => {
  it('rejects a non-ASCII address inline and does not send the invite', async () => {
    setup()
    await screen.findByText('Sari')

    await userEvent.type(screen.getByLabelText(/nama/i), 'Nadia')
    await userEvent.type(screen.getByLabelText(/email/i), 'nadia@café.com')
    await userEvent.click(
      screen.getByRole('button', { name: /kirim undangan/i }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /format email tidak valid/i,
    )
    expect(screen.queryByText('Nadia')).not.toBeInTheDocument()
  })

  it('surfaces the API 409 wording verbatim rather than a generic message', async () => {
    setup()
    await screen.findByText('Sari')

    await userEvent.type(screen.getByLabelText(/nama/i), 'Sari lagi')
    // Already active in this household — the API answers 409 with copy that is
    // itself the feature.
    await userEvent.type(screen.getByLabelText(/email/i), 'sari@example.com')
    await userEvent.click(
      screen.getByRole('button', { name: /kirim undangan/i }),
    )

    expect(
      await screen.findByText(/already in a household/i),
    ).toBeInTheDocument()
  })

  it('renders the status the server derived, including invite_expired', async () => {
    setup()
    expect(await screen.findByText('Dewi')).toBeInTheDocument()
    // Dewi left; Asep has a live invite; Tono's lapsed. `invite_expired` is a
    // state the API distinguishes and the FE used to collapse into 'pending',
    // which offered no reason the link had stopped working.
    expect(screen.getByText(/^Keluar$/)).toBeInTheDocument()
    expect(screen.getByText(/^Menunggu$/)).toBeInTheDocument()
    expect(screen.getByText(/^Undangan kedaluwarsa$/)).toBeInTheDocument()
  })

  it('keeps the resend control on an expired invite, disabled once the ration is spent', async () => {
    setup()
    await screen.findByText('Tono')
    // Resending is the only recovery from an expiry, so the control has to
    // outlive the invite rather than vanish with it.
    const resends = screen.getAllByRole('button', { name: /kirim ulang/i })
    expect(resends).toHaveLength(2)
    // Asep has one of three spent; Tono has all three.
    expect(resends.map((button) => button.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Sisa 2 kali'),
        expect.stringContaining('Sisa 0 kali'),
      ]),
    )
    expect(
      resends.find((button) => button.textContent?.includes('Sisa 0 kali')),
    ).toBeDisabled()
  })

  it('hides invite and remove controls from members', async () => {
    setup({ canManage: false, currentUserId: 'user-002' })
    await screen.findByText(/^Sari/)

    expect(
      screen.queryByRole('button', { name: /kirim undangan/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /keluarkan/i }),
    ).not.toBeInTheDocument()
  })

  it('never shows a remove control for an admin or for yourself', async () => {
    setup()
    await screen.findByText(/^Budi/)
    await waitFor(() => {
      const removes = screen.queryAllByRole('button', { name: /keluarkan/i })
      // Sari, Rina, Asep, Tono — never Budi (admin, and the caller), and never
      // Dewi, who is already tombstoned.
      expect(removes).toHaveLength(4)
    })
  })
})
