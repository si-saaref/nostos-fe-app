import { useSettings } from '@/contexts/useSettings'
import { m } from '@/paraglide/messages.js'

/**
 * The only sanctioned way to read messages inside a component.
 *
 * Paraglide messages are plain functions that read the ambient locale when
 * called, so a component that imports them directly will happily keep showing
 * the previous language until something else re-renders it. Reading them
 * through this hook subscribes the component to locale changes, which makes
 * using messages and subscribing to them the same act — you cannot do one and
 * forget the other.
 *
 * Module-scope use (a nav table, a constant) is fine as long as the component
 * that renders it also calls this hook or `useSettings`.
 */
export const useMessages = () => {
  useSettings()
  return m
}
