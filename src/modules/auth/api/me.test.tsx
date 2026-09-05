import { renderHook, waitFor } from '@testing-library/react'
import { server } from '@/mocks/server'
import { authHandlers } from '@/mocks/handlers/auth'
import { authState } from '@/mocks/db'
import { createWrapper } from '@/test/test-utils'
import { useMe } from '@/modules/auth/api/me'
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
