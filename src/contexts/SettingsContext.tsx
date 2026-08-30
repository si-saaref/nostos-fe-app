import { createContext, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getLocale, setLocale } from '@/paraglide/runtime.js'
import type { Lang } from '@/i18n/locales'
import { DEFAULT_THEME, applyTheme, readStoredTheme } from '@/theme/themes'
import type { ThemeId } from '@/theme/themes'

export interface SettingsValue {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  lang: Lang
  setLang: (lang: Lang) => void
  /** Locale tag for Intl formatting (currency, dates), derived from the language. */
  locale: string
}

// Same shape as HouseholdContext: context and provider live together, and the
// fast-refresh rule is waived for the pair.
// eslint-disable-next-line react-refresh/only-export-components
export const SettingsContext = createContext<SettingsValue | undefined>(
  undefined,
)

const isBrowser = typeof window !== 'undefined'

const INTL_LOCALE: Record<string, string> = {
  id: 'id-ID',
  en: 'en-US',
}

/**
 * Theme and language.
 *
 * Paraglide owns the locale: it persists it, resolves it from the device on
 * first visit, and compiles each message into its own module. This provider
 * only mirrors the current locale into React state so a switch re-renders the
 * tree — `setLocale` is called with `reload: false` because a full reload
 * would throw away in-flight queries and scroll position for a preference
 * change.
 */
export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeId>(() =>
    isBrowser ? readStoredTheme() : DEFAULT_THEME,
  )
  const [lang, setLangState] = useState<Lang>(() => getLocale())

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next)
    applyTheme(next)
  }, [])

  const setLang = useCallback((next: Lang) => {
    setLocale(next, { reload: false })
    document.documentElement.lang = next
    setLangState(next)
  }, [])

  const value = useMemo<SettingsValue>(
    () => ({
      theme,
      setTheme,
      lang,
      setLang,
      locale: INTL_LOCALE[lang] ?? lang,
    }),
    [theme, setTheme, lang, setLang],
  )

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}
