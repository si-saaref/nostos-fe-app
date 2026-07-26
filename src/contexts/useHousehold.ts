import { useContext } from 'react'
import { HouseholdContext } from '@/contexts/HouseholdContext'
import type { HouseholdContextValue } from '@/contexts/HouseholdContext'

export const useHousehold = (): HouseholdContextValue => {
  const context = useContext(HouseholdContext)
  if (!context) {
    throw new Error('useHousehold must be used within HouseholdProvider')
  }
  return context
}
