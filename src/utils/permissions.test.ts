import { canManageExpenses } from '@/utils/permissions'

describe('permissions', () => {
  it('lets admins manage expenses and members not', () => {
    expect(canManageExpenses('admin')).toBe(true)
    expect(canManageExpenses('member')).toBe(false)
  })
})
