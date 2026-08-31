import type { Household, User } from '@/types/household'

export const MOCK_HOUSEHOLD: Household = {
  id: 'household-001',
  name: 'Keluarga Adios',
}

export const MOCK_USER: User = {
  id: 'user-001',
  name: 'Budi',
  email: 'budi@example.com',
  role: 'admin',
  householdId: MOCK_HOUSEHOLD.id,
}
