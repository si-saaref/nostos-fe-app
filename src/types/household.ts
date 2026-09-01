/**
 * The server's own casing, preserved rather than re-cased. A lowercase domain
 * copy would mean a two-way mapping to maintain and would stop matching what
 * the network tab shows during debugging.
 *
 * A const object rather than a TS `enum`: `tsconfig.app.json` sets
 * `erasableSyntaxOnly`, under which `enum` does not compile.
 */
export const Role = { ADMIN: 'ADMIN', MEMBER: 'MEMBER' } as const
export type Role = (typeof Role)[keyof typeof Role]

export const HouseholdStatus = {
  ACTIVE: 'ACTIVE',
  DELETION_PENDING: 'DELETION_PENDING',
} as const
export type HouseholdStatus =
  (typeof HouseholdStatus)[keyof typeof HouseholdStatus]

/**
 * `GET /auth/me`, exactly as the wire sends it.
 *
 * Snake_case on purpose: camelCase mapping happens per module as each one
 * integrates, so this shape stays diffable against the API docs until then.
 */
export interface Me {
  user_id: string
  household_id: string
  household_name: string
  email: string
  name: string
  role: Role
  household_status: HouseholdStatus
  scheduled_deletion_date: string | null
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  householdId: string
}
