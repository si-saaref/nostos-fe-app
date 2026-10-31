import { createContext } from 'react'

export interface NotificationInput {
  title: string
  description?: string
  tone?: 'success' | 'error' | 'info'
  duration?: number
}

export interface NotificationsValue {
  notify: (notification: NotificationInput) => number
  dismiss: (id: number) => void
}

export const NotificationContext = createContext<
  NotificationsValue | undefined
>(undefined)
