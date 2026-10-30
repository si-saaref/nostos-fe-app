import { useContext } from 'react'
import { NotificationContext } from './NotificationContext'

export const useNotifications = () => {
  const value = useContext(NotificationContext)
  if (!value)
    throw new Error('useNotifications must be used within NotificationProvider')
  return value
}
