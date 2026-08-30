import type { Role } from '@/types/household'

/**
 * The matrix from the master document, which the shipped code had inverted:
 * members create and read; only admins change or remove history.
 */
export const canCreateExpenses = (): boolean => true

/** Update, delete and export — the treasurer's actions. */
export const canManageExpenses = (role: Role): boolean => role === 'admin'

export const hasRole = (role: Role, required: Role): boolean =>
  role === required
