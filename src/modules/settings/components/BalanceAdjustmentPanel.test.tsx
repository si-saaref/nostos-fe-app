import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BalanceAdjustmentPanel } from '@/modules/settings/components/BalanceAdjustmentPanel'
import { db } from '@/mocks/db'
import { renderWithProviders } from '@/test/test-utils'

describe('BalanceAdjustmentPanel', () => {
  it('reconciles to a target balance and renders the authoritative result', async () => {
    const account = db.accounts[0]
    renderWithProviders(
      <BalanceAdjustmentPanel
        householdId={account.householdId}
        account={account}
        canManage
      />,
    )

    await userEvent.click(
      screen.getByRole('button', { name: /koreksi saldo/i }),
    )
    expect(screen.queryByLabelText(/tanggal koreksi/i)).toBeNull()
    expect(screen.queryByLabelText(/^koreksi saldo$/i)).toBeNull()
    await userEvent.type(screen.getByLabelText(/saldo target/i), '100000')
    await userEvent.type(
      screen.getByLabelText(/alasan koreksi/i),
      'Hitung ulang tunai',
    )
    await userEvent.click(screen.getByRole('button', { name: /^simpan$/i }))

    await waitFor(() => expect(screen.getByText(/saldo sekarang/i)).toHaveTextContent('100.000'))
    expect(db.adjustments).toMatchObject([
      {
        sourceId: account.id,
        delta: 100000 - account.openingBalance,
        reason: 'Hitung ulang tunai',
      },
    ])
  })

  it('keeps the entered target and reason when reconciliation fails', async () => {
    const account = db.accounts[0]
    renderWithProviders(
      <BalanceAdjustmentPanel
        householdId={account.householdId}
        account={{ ...account, id: 'missing' }}
        canManage
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /koreksi saldo/i }))
    await userEvent.type(screen.getByLabelText(/saldo target/i), '250000')
    await userEvent.type(screen.getByLabelText(/alasan koreksi/i), 'Cocokkan rekening')
    await userEvent.click(screen.getByRole('button', { name: /^simpan$/i }))

    expect(await screen.findByText('Account not found')).toHaveAttribute('role', 'alert')
    expect(screen.getByLabelText(/saldo target/i)).toHaveValue('250.000')
    expect(screen.getByLabelText(/alasan koreksi/i)).toHaveValue('Cocokkan rekening')
  })
})
