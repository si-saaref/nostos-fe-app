import { HouseholdStatus, Role } from '@/types/household'
import type { Me, User } from '@/types/household'

export const MOCK_HOUSEHOLD = {
  id: 'household-001',
  name: 'Keluarga Adios',
}

export const MOCK_USER: User = {
  id: 'user-001',
  name: 'Budi',
  email: 'budi@example.com',
  role: Role.ADMIN,
  householdId: MOCK_HOUSEHOLD.id,
}

export const MOCK_ME: Me = {
  user_id: MOCK_USER.id,
  household_id: MOCK_HOUSEHOLD.id,
  household_name: MOCK_HOUSEHOLD.name,
  email: MOCK_USER.email,
  name: MOCK_USER.name,
  role: Role.ADMIN,
  household_status: HouseholdStatus.ACTIVE,
  scheduled_deletion_date: null,
}
