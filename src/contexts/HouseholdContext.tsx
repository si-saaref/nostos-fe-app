import { createContext } from 'react'
import type { ReactNode } from 'react'
import { useSession } from '@/modules/auth/api/session'
import { setHouseholdId } from '@/api/client'
import type { Household, Role, User } from '@/types/household'

export interface HouseholdContextValue {
  user: User | null
  household: Household | null
  householdId: string
  role: Role
  isAuthenticated: boolean
  isLoading: boolean
}

// eslint-disable-next-line react-refresh/only-export-components
export const HouseholdContext = createContext<
  HouseholdContextValue | undefined
>(undefined)

export const HouseholdProvider = ({ children }: { children: ReactNode }) => {
  const { data: session, isLoading } = useSession()
  const householdId = session?.household?.id ?? ''

  // Set synchronously during render (not in an effect) so the axios request
  // interceptor has the header value before any descendant's effect fires
  // its first request — e.g. a deep-link straight to /financial/expenses.
  setHouseholdId(householdId)

  const value: HouseholdContextValue = {
    user: session?.user ?? null,
    household: session?.household ?? null,
    householdId,
    role: session?.user?.role ?? 'member',
    isAuthenticated: Boolean(session?.user),
    isLoading,
  }

  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  )
}
