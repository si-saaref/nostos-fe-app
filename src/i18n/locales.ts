import { locales } from '@/paraglide/runtime.js'

export type Lang = (typeof locales)[number]

/**
 * Endonyms — a language is always named in itself, never translated, so the
 * switcher is readable to someone who cannot read the current language.
 */
const LABELS: Record<string, string> = {
  id: 'Bahasa Indonesia',
  en: 'English',
}

export const LANGS = locales.map((id) => ({
  id,
  label: LABELS[id] ?? id,
}))

export const isLang = (value: unknown): value is Lang =>
  locales.includes(value as Lang)
