import { screen } from '@testing-library/react'
import { setLocale } from '@/paraglide/runtime.js'
import { PersonalPreferencesSection } from '@/modules/settings/components/PersonalPreferencesSection'
import { chooseOption, renderWithProviders } from '@/test/test-utils'
import { THEME_STORAGE_KEY } from '@/theme/themes'

describe('PersonalPreferencesSection', () => {
  it('persists device theme and language without household controls', async () => {
    renderWithProviders(<PersonalPreferencesSection />)

    await chooseOption(/tema/i, 'Kobalt')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('kobalt')
    await chooseOption(/bahasa/i, 'English')
    expect(document.documentElement.lang).toBe('en')

    expect(screen.queryByRole('combobox', { name: /mata uang|currency/i }))
      .toBeNull()
    expect(screen.queryByRole('combobox', { name: /awal bulan|month start/i }))
      .toBeNull()

    setLocale('id', { reload: false })
    document.documentElement.lang = 'id'
    localStorage.removeItem(THEME_STORAGE_KEY)
    delete document.documentElement.dataset.theme
  })
})
