import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'
import { authHandlers } from '@/mocks/handlers/auth'
import { authState } from '@/mocks/db'
import { Sidebar } from '@/components/Layout/Sidebar'

describe('Sidebar', () => {
  beforeEach(() => {
    server.use(...authHandlers)
    authState.authenticated = true
  })

  it('shows who is signed in and which household', () => {
    renderWithProviders(<Sidebar />)
    expect(screen.getByText('Budi')).toBeInTheDocument()
    expect(screen.getByText('Keluarga Adios')).toBeInTheDocument()
  })

  it('signs out through the API', async () => {
    renderWithProviders(<Sidebar />)

    await userEvent.click(screen.getByRole('button', { name: /keluar/i }))

    await waitFor(() => expect(authState.authenticated).toBe(false))
  })
})
