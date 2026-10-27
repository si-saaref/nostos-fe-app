import { Select } from '@/components/Select'
import { useSettings } from '@/contexts/useSettings'
import { useMessages } from '@/i18n/useMessages'
import { LANGS, isLang } from '@/i18n/locales'
import { SETTINGS_ANCHORS } from '@/modules/settings/anchors'
import { SectionShell } from '@/modules/settings/components/SectionShell'
import { THEMES, isThemeId } from '@/theme/themes'

export const PersonalPreferencesSection = () => {
  const m = useMessages()
  const { theme, setTheme, lang, setLang } = useSettings()

  return (
    <SectionShell
      id={SETTINGS_ANCHORS.personalPreferences}
      title={m.settings_personal_preferences()}
      description={m.settings_personal_preferences_desc()}
      canManage
    >
      <div className="bg-card plate-shadow rounded-xl p-4">
        <p className="text-muted text-[10.5px]">{m.pref_personal_note()}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Select
            label={m.theme_label()}
            value={theme}
            onChange={(value) => isThemeId(value) && setTheme(value)}
            options={THEMES.map((option) => ({ value: option.id, label: option.label }))}
          />
          <Select
            label={m.lang_label()}
            value={lang}
            onChange={(value) => isLang(value) && setLang(value)}
            options={LANGS.map((option) => ({ value: option.id, label: option.label }))}
          />
        </div>
      </div>
    </SectionShell>
  )
}
