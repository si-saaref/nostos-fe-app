import { canManageExpenses } from '@/utils/permissions'
import { Role } from '@/types/household'

describe('canManageExpenses', () => {
  it('lets an admin manage', () => {
    expect(canManageExpenses(Role.ADMIN)).toBe(true)
  })

  it('does not let a member manage', () => {
    expect(canManageExpenses(Role.MEMBER)).toBe(false)
  })

  it('uses the API casing, so a lowercase role is not an admin', () => {
    // Guards the migration: the old values were 'admin'/'member'. If anything
    // still hands those through, it must not silently read as an admin.
    expect(canManageExpenses('admin' as unknown as Role)).toBe(false)
  })
})
