import { useSyncExternalStore } from 'react'
const query = '(max-width: 1023px)'
const subscribe = (notify: () => void) => {
  const media = window.matchMedia?.(query)
  media?.addEventListener('change', notify)
  return () => media?.removeEventListener('change', notify)
}
export const usePhone = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  )
