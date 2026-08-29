import { useMessages } from '@/i18n/useMessages'
import { useSettings } from '@/contexts/useSettings'
import { Field, SectionShell } from '@/modules/settings/components/parts'
import { useHouseholdPrefs, useUpdatePrefs } from '@/api/queries/settings'
import { LANGS } from '@/i18n/locales'
import type { Lang } from '@/i18n/locales'
import { THEMES } from '@/theme/themes'
import type { ThemeId } from '@/theme/themes'

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
  const { mutate: update } = useUpdatePrefs(householdId)

  return (
    <SectionShell
      id="rumah"
      title={m.pref_title()}
      description={m.settings_intro()}
      canManage={canManage}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
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
            <Field label={m.pref_currency()}>
              <select
                value={prefs?.currency ?? 'IDR'}
                disabled={!canManage}
                onChange={(event) => update({ currency: event.target.value })}
                className="well-shadow bg-chip rounded-lg px-3 py-2 text-[12.5px] outline-none disabled:opacity-60"
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={m.pref_month_start()}>
              <select
                value={prefs?.monthStartDay ?? 1}
                disabled={!canManage}
                onChange={(event) =>
                  update({ monthStartDay: Number(event.target.value) })
                }
                className="well-shadow bg-chip rounded-lg px-3 py-2 text-[12.5px] outline-none disabled:opacity-60"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </Field>
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
            <Field label={m.theme_label()}>
              <select
                value={theme}
                onChange={(event) => setTheme(event.target.value as ThemeId)}
                className="well-shadow bg-chip rounded-lg px-3 py-2 text-[12.5px] outline-none"
              >
                {THEMES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={m.lang_label()}>
              <select
                value={lang}
                onChange={(event) => setLang(event.target.value as Lang)}
                className="well-shadow bg-chip rounded-lg px-3 py-2 text-[12.5px] outline-none"
              >
                {LANGS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>
    </SectionShell>
  )
}
