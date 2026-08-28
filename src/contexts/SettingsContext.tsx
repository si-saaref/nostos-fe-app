import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  DEFAULT_LANG,
  LANG_STORAGE_KEY,
  readStoredLang,
  translate,
} from '@/i18n/strings'
import type { Lang } from '@/i18n/strings'
import { DEFAULT_THEME, applyTheme, readStoredTheme } from '@/theme/themes'
import type { ThemeId } from '@/theme/themes'
import { createContext } from 'react'
import type { StringKey } from '@/i18n/strings'

export interface SettingsValue {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: StringKey, vars?: Record<string, string | number>) => string
  /** Locale tag for Intl formatting, derived from the chosen language. */
  locale: string
}

// Same shape as HouseholdContext: context and provider live together, and the
// fast-refresh rule is waived for the pair.
// eslint-disable-next-line react-refresh/only-export-components
export const SettingsContext = createContext<SettingsValue | undefined>(
  undefined,
)

const isBrowser = typeof window !== 'undefined'

/**
 * Theme and language. The theme is applied to <html> before React mounts (see
 * main.tsx), so the document never paints a frame in the wrong palette; this
 * provider only handles changes after that.
 */
export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeId>(() =>
    isBrowser ? readStoredTheme() : DEFAULT_THEME,
  )
  const [lang, setLangState] = useState<Lang>(() =>
    isBrowser ? readStoredLang() : DEFAULT_LANG,
  )

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next)
    applyTheme(next)
  }, [])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    document.documentElement.lang = next
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next)
    } catch {
      // Storage unavailable; the choice still applies for this session.
    }
  }, [])

  const value = useMemo<SettingsValue>(
    () => ({
      theme,
      setTheme,
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      locale: lang === 'id' ? 'id-ID' : 'en-US',
    }),
    [theme, setTheme, lang, setLang],
  )

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}
