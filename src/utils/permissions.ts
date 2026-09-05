import { Role } from '@/types/household'

/**
 * The matrix from the master document: members create and read; only admins
 * change or remove history. Creating is not gated, so there is no predicate
 * for it — a function that returns `true` for everyone is a permission check
 * that reads like one and is not.
 */
export const canManageExpenses = (role: Role): boolean => role === Role.ADMIN
