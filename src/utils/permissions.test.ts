import { canManageExpenses, hasRole } from '@/utils/permissions'

describe('permissions', () => {
  it('lets admins manage expenses', () => {
    expect(canManageExpenses('admin')).toBe(true)
    expect(canManageExpenses('member')).toBe(false)
  })

  it('checks an exact role', () => {
    expect(hasRole('admin', 'admin')).toBe(true)
    expect(hasRole('member', 'admin')).toBe(false)
  })
})
