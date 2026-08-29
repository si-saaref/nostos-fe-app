import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { MemberSection } from '@/modules/settings/components/MemberSection'

it('dbg', async () => {
  renderWithProviders(
    <MemberSection
      householdId="household-001"
      householdName="H"
      canManage
      currentUserId="user-001"
    />,
  )
  await screen.findByText('Sari')
  await userEvent.type(screen.getByLabelText(/nama/i), 'Nadia')
  await userEvent.type(screen.getByLabelText(/email/i), 'nadia@café.com')
  await userEvent.click(screen.getByRole('button', { name: /kirim undangan/i }))
})
