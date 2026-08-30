/**
 * Theme registry. A theme is a block of CSS custom properties in
 * `src/styles/globals.css` plus an entry here. Components never name a colour,
 * so adding a theme is a two-file change and touches no UI code.
 */
export const THEMES = [
  { id: 'mawar', label: 'Mawar' },
  { id: 'kobalt', label: 'Kobalt' },
  { id: 'tegel', label: 'Tegel Kunci' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const DEFAULT_THEME: ThemeId = 'mawar'
export const THEME_STORAGE_KEY = 'nostos.theme'

export const isThemeId = (value: unknown): value is ThemeId =>
  THEMES.some((theme) => theme.id === value)

/** Read the stored theme, tolerating private-mode storage failures. */
export const readStoredTheme = (): ThemeId => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeId(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export const applyTheme = (theme: ThemeId) => {
  document.documentElement.dataset.theme = theme
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage unavailable (private mode, blocked site data). The theme still
    // applies for this session; it just will not be remembered.
  }
}
