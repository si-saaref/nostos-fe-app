import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { HouseholdDeletionModal } from '@/modules/auth/signin/HouseholdDeletionModal'

const renderModal = (deadline: string | null, onDismiss = vi.fn()) => {
  render(
    <SettingsProvider>
      <HouseholdDeletionModal deadline={deadline} onDismiss={onDismiss} />
    </SettingsProvider>,
  )
  return onDismiss
}

describe('HouseholdDeletionModal', () => {
  it('stays shut without a deadline', () => {
    renderModal(null)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('announces itself as an alert dialog and states the deadline', () => {
    renderModal('2026-09-26')
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent(/rumah ini sedang dihapus/i)
    expect(dialog).toHaveTextContent(/2026/)
  })

  it('names no one', () => {
    // It renders for an unauthenticated stranger who typed an address into a
    // box. Any identity here turns signin into a harvester.
    renderModal('2026-09-26')
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).not.toHaveTextContent(/keluarga adios/i)
    expect(dialog).not.toHaveTextContent(/@/)
  })

  it('dismisses on the button', async () => {
    const onDismiss = renderModal('2026-09-26')
    await userEvent.click(screen.getByRole('button', { name: /kembali/i }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('dismisses on Escape', async () => {
    const onDismiss = renderModal('2026-09-26')
    await userEvent.keyboard('{Escape}')
    expect(onDismiss).toHaveBeenCalled()
  })
})
