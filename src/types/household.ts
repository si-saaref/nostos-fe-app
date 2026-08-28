export type Role = 'admin' | 'member'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  householdId: string
}

export interface Household {
  id: string
  name: string
}

export interface Session {
  user: User
  household: Household
}
