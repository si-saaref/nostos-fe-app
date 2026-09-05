import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { SectionShell } from '@/modules/settings/components/SectionShell'
import { Select } from '@/components/Select'
import { useHouseholdPrefs, useUpdatePrefs } from '@/modules/settings/api/prefs'
import { SETTINGS_ANCHORS } from '@/modules/settings/anchors'
import { LANGS, isLang } from '@/i18n/locales'
import { THEMES, isThemeId } from '@/theme/themes'

interface Props {
  householdId: string
  canManage: boolean
}

const CURRENCIES = ['IDR', 'USD', 'SGD', 'MYR', 'EUR']

/**
 * Two kinds of setting live here, and the split is the point: what the
 * household shares, and what belongs to this person on this device. A member
 * choosing a different theme must not repaint the admin's laptop.
 */
export const PreferencesSection = ({ householdId, canManage }: Props) => {
  const m = useMessages()
  const { theme, setTheme, lang, setLang } = useSettings()
  const {
    data: prefs,
    isLoading,
    isError,
    refetch,
  } = useHouseholdPrefs(householdId)
  const { mutate: update, error: updateError } = useUpdatePrefs(householdId)

  return (
    <SectionShell
      id={SETTINGS_ANCHORS.household}
      title={m.pref_title()}
      description={m.settings_intro()}
      canManage={canManage}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
      actionError={updateError}
    >
      <div className="flex flex-col gap-3">
        <div className="bg-card plate-shadow rounded-xl p-4">
          <p className="font-display text-[12.5px] font-bold">
            {m.pref_household()}
          </p>
          <p className="text-muted mt-1 text-[10.5px]">
            {m.pref_household_note()}
          </p>

          <div className="mt-3 flex flex-wrap gap-3">
            <Select
              label={m.pref_currency()}
              value={prefs?.currency ?? 'IDR'}
              disabled={!canManage}
              onChange={(value) => update({ currency: value })}
              options={CURRENCIES.map((code) => ({ value: code, label: code }))}
            />

            <Select
              label={m.pref_month_start()}
              value={String(prefs?.monthStartDay ?? 1)}
              disabled={!canManage}
              onChange={(value) => update({ monthStartDay: Number(value) })}
              options={Array.from({ length: 28 }, (_, i) => ({
                value: String(i + 1),
                label: String(i + 1),
              }))}
            />
          </div>
        </div>

        <div className="bg-card plate-shadow rounded-xl p-4">
          <p className="font-display text-[12.5px] font-bold">
            {m.pref_personal()}
          </p>
          <p className="text-muted mt-1 text-[10.5px]">
            {m.pref_personal_note()}
          </p>

          <div className="mt-3 flex flex-wrap gap-3">
            {/* Guarded rather than cast: the Select speaks in strings, and a
                cast here would let a stale option id become a theme id. */}
            <Select
              label={m.theme_label()}
              value={theme}
              onChange={(value) => isThemeId(value) && setTheme(value)}
              options={THEMES.map((option) => ({
                value: option.id,
                label: option.label,
              }))}
            />

            <Select
              label={m.lang_label()}
              value={lang}
              onChange={(value) => isLang(value) && setLang(value)}
              options={LANGS.map((option) => ({
                value: option.id,
                label: option.label,
              }))}
            />
          </div>
        </div>
      </div>
    </SectionShell>
  )
}
