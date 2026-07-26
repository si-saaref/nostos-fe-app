import type { Role } from '@/types/household'

export const canManageExpenses = (role: Role): boolean => role === 'admin'

export const hasRole = (role: Role, required: Role): boolean => role === required
