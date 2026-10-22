import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BalanceAdjustmentPanel } from '@/modules/settings/components/BalanceAdjustmentPanel'
import { db } from '@/mocks/db'
import { renderWithProviders } from '@/test/test-utils'

describe('BalanceAdjustmentPanel', () => {
  it('records a correction with a reason and shows it in history', async () => {
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
    await userEvent.type(screen.getByLabelText(/selisih saldo/i), '100000')
    await userEvent.type(
      screen.getByLabelText(/alasan koreksi/i),
      'Hitung ulang tunai',
    )
    await userEvent.click(screen.getByRole('button', { name: /^simpan$/i }))

    await waitFor(() =>
      expect(screen.getByText(/hitung ulang tunai/i)).toBeInTheDocument(),
    )
    expect(db.adjustments).toMatchObject([
      {
        sourceId: account.id,
        delta: 100000,
        reason: 'Hitung ulang tunai',
      },
    ])
  })
})
