import { useMessages } from '@/i18n/useMessages'
import { SectionShell } from '@/modules/settings/components/SectionShell'
import { Select } from '@/components/Select'
import { useHouseholdPrefs, useUpdatePrefs } from '@/modules/settings/api/prefs'
import { SETTINGS_ANCHORS } from '@/modules/settings/anchors'
import { getErrorStatus } from '@/utils/errors'

interface Props {
  householdId: string
  canManage: boolean
}

const CURRENCIES = ['IDR', 'USD', 'SGD', 'MYR', 'EUR']

/** Shared accounting interpretation. Personal device choices live in My Account. */
export const PreferencesSection = ({ householdId, canManage }: Props) => {
  const m = useMessages()
  const {
    data: prefs,
    isLoading,
    isError,
    error,
    refetch,
  } = useHouseholdPrefs(householdId)
  const { mutate: update, error: updateError } = useUpdatePrefs(householdId)

  // Unbuilt, not broken: a retry cannot help, so don't offer one.
  const notShipped = isError && getErrorStatus(error) === 404

  return (
    <SectionShell
      id={SETTINGS_ANCHORS.householdAccounting}
      title={m.settings_household_accounting()}
      description={m.pref_household_note()}
      canManage={canManage}
      isLoading={isLoading}
      isError={isError && !notShipped}
      onRetry={refetch}
      actionError={notShipped ? undefined : updateError}
    >
      <div className="bg-card plate-shadow rounded-xl p-4">
          {notShipped && (
            <p className="bg-chip text-muted mt-3 rounded-lg px-3 py-2 text-[11px]">
              {m.pref_unavailable()}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-3">
            <Select
              label={m.pref_currency()}
              value={prefs?.currency ?? 'IDR'}
              disabled={!canManage || notShipped}
              onChange={(value) => update({ currency: value })}
              options={CURRENCIES.map((code) => ({ value: code, label: code }))}
            />

            <Select
              label={m.pref_month_start()}
              value={String(prefs?.monthStartDay ?? 1)}
              disabled={!canManage || notShipped}
              onChange={(value) => update({ monthStartDay: Number(value) })}
              options={Array.from({ length: 28 }, (_, i) => ({
                value: String(i + 1),
                label: String(i + 1),
              }))}
            />
          </div>
      </div>
    </SectionShell>
  )
}
