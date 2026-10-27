import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { server } from '@/mocks/server'
import { authHandlers } from '@/mocks/handlers/auth'
import { authState } from '@/mocks/db'
import { createTestQueryClient, createWrapper } from '@/test/test-utils'
import { meKey, useChangeName, useMe } from '@/modules/auth/api/me'
import { MOCK_ME } from '@/mocks/fixtures/household'
import { entityKey } from '@/api/keys'
import { HouseholdStatus, Role } from '@/types/household'

describe('useMe', () => {
  it('unwraps the envelope into the wire shape', async () => {
    server.use(...authHandlers)
    authState.authenticated = true

    const { result } = renderHook(() => useMe(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({
      household_name: 'Keluarga Adios',
      role: Role.ADMIN,
      household_status: HouseholdStatus.ACTIVE,
      scheduled_deletion_date: null,
      first_name: 'Budi',
      last_name: 'Santoso',
    })
  })

  it('does not retry the anonymous 401', async () => {
    server.use(...authHandlers)
    // authState defaults to unauthenticated via resetMockState.

    const { result } = renderHook(() => useMe(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.failureCount).toBe(1)
  })
})

describe('useChangeName', () => {
  it('updates only the authenticated profile cache', async () => {
    const client = createTestQueryClient()
    const householdKey = entityKey('household-001', 'members')
    const members = [{ id: 'member-1', name: 'Budi Santoso' }]
    client.setQueryData(meKey, MOCK_ME)
    client.setQueryData(householdKey, members)
    server.use(
      http.patch('*/api/v1/auth/me/name', () =>
        HttpResponse.json({
          success: true,
          data: { ...MOCK_ME, name: 'Budi Wijaya', last_name: 'Wijaya' },
        }),
      ),
    )
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useChangeName(), { wrapper })

    await act(() =>
      result.current.mutateAsync({ firstName: 'Budi', lastName: 'Wijaya' }),
    )

    expect(client.getQueryData(meKey)).toMatchObject({ last_name: 'Wijaya' })
    expect(client.getQueryData(householdKey)).toBe(members)
  })
})
