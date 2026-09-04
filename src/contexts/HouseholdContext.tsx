import { createContext } from 'react'
import type { ReactNode } from 'react'
import { useMe } from '@/modules/auth/api/me'
import { setHouseholdId } from '@/api/client'
import { Role } from '@/types/household'
import type { HouseholdStatus, Me } from '@/types/household'

export interface HouseholdContextValue {
  me: Me | null
  householdId: string
  role: Role
  isAuthenticated: boolean
  isLoading: boolean
  householdStatus: HouseholdStatus | null
  scheduledDeletionDate: string | null
}

// eslint-disable-next-line react-refresh/only-export-components
export const HouseholdContext = createContext<
  HouseholdContextValue | undefined
>(undefined)

export const HouseholdProvider = ({ children }: { children: ReactNode }) => {
  const { data: me, isLoading, isError } = useMe()
  const householdId = me?.household_id ?? ''

  setHouseholdId(householdId)

  const value: HouseholdContextValue = {
    me: me ?? null,
    householdId,
    role: me?.role ?? Role.MEMBER,
    isAuthenticated: Boolean(me) && !isError,
    isLoading,
    householdStatus: me?.household_status ?? null,
    scheduledDeletionDate: me?.scheduled_deletion_date ?? null,
  }

  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  )
}
