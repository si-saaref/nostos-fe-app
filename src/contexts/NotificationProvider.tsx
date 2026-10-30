import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { Toast } from 'radix-ui'
import { useMessages } from '@/i18n/useMessages'
import {
  NotificationContext,
  type NotificationInput,
} from './NotificationContext'

interface Notification extends NotificationInput {
  id: number
}

/** One viewport above routing: feedback survives navigation and form unmounts. */
export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const m = useMessages()
  const nextId = useRef(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const dismiss = useCallback((id: number) => {
    setNotifications((items) => items.filter((item) => item.id !== id))
  }, [])
  const notify = useCallback((input: NotificationInput) => {
    const id = ++nextId.current
    setNotifications((items) => [...items.slice(-2), { ...input, id }])
    return id
  }, [])
  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss])

  return (
    <NotificationContext.Provider value={value}>
      <Toast.Provider
        label={m.notification_label()}
        duration={5000}
        swipeDirection="right"
      >
        {children}
        {notifications.map(
          ({ id, title, description, tone = 'success', duration }) => (
            <Toast.Root
              key={id}
              open
              role={tone === 'error' ? 'alert' : 'status'}
              aria-label={title}
              // Radix owns the live announcer; avoid announcing the visible card twice.
              aria-live="off"
              type={tone === 'error' ? 'foreground' : 'background'}
              duration={duration ?? (tone === 'error' ? 8000 : 5000)}
              onOpenChange={(open) => {
                if (!open) dismiss(id)
              }}
              className="notification-toast bg-card text-ink lift-shadow pointer-events-auto grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-xl p-4"
            >
              <span
                className={`mt-0.5 ${tone === 'error' ? 'text-danger' : tone === 'success' ? 'text-flow-in' : 'text-accent'}`}
              >
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path
                    d={
                      tone === 'success'
                        ? 'm8 12 3 3 5-6'
                        : tone === 'error'
                          ? 'M12 7v6m0 3h.01'
                          : 'M12 11v6m0-10h.01'
                    }
                  />
                </svg>
              </span>
              <div className="min-w-0">
                <Toast.Title className="text-[13px] leading-5 font-semibold break-words">
                  {title}
                </Toast.Title>
                {description && (
                  <Toast.Description className="text-muted mt-1 text-xs leading-relaxed break-words">
                    {description}
                  </Toast.Description>
                )}
              </div>
              <Toast.Close
                aria-label={m.notification_dismiss()}
                className="text-muted hover:bg-chip hover:text-ink -mt-1 -mr-1 grid h-8 w-8 place-items-center rounded-lg"
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </Toast.Close>
            </Toast.Root>
          ),
        )}
        <Toast.Viewport
          hidden={notifications.length === 0}
          label={m.notification_viewport()}
          className="pointer-events-none fixed inset-x-4 top-[calc(env(safe-area-inset-top)+1rem)] z-[100] m-0 flex max-h-[calc(100dvh-2rem)] list-none flex-col gap-2 overflow-y-auto overscroll-contain p-1 outline-none sm:right-5 sm:left-auto sm:w-96"
        />
      </Toast.Provider>
    </NotificationContext.Provider>
  )
}
