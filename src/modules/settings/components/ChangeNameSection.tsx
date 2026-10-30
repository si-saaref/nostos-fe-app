import { useState, type FormEvent } from 'react'
import { useHousehold } from '@/contexts/useHousehold'
import { useNotifications } from '@/contexts/useNotifications'
import { useMessages } from '@/i18n/useMessages'
import { useChangeName } from '@/modules/auth/api/me'
import { SETTINGS_ANCHORS } from '@/modules/settings/anchors'
import { SectionShell } from '@/modules/settings/components/SectionShell'
import { getErrorMessage } from '@/utils/errors'

const legacyNameParts = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return { firstName: parts[0] ?? '', lastName: '' }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.at(-1) ?? '',
  }
}

export const ChangeNameSection = () => {
  const m = useMessages()
  const { me } = useHousehold()
  const { notify } = useNotifications()
  const fallback = legacyNameParts(me?.name ?? '')
  const [savedName, setSavedName] = useState(() => ({
    firstName: me?.first_name ?? fallback.firstName,
    lastName: me?.last_name ?? fallback.lastName,
  }))
  const [firstName, setFirstName] = useState(savedName.firstName)
  const [lastName, setLastName] = useState(savedName.lastName)
  const changeName = useChangeName()
  const isDirty =
    firstName.trim() !== savedName.firstName ||
    lastName.trim() !== savedName.lastName
  const canSave =
    isDirty && !!firstName.trim() && !!lastName.trim() && !changeName.isPending

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSave) return
    const name = { firstName: firstName.trim(), lastName: lastName.trim() }
    try {
      // Awaiting the request keeps global feedback alive even if this page
      // unmounts before the mutation finishes.
      const profile = await changeName.mutateAsync(name)
      const returnedName = legacyNameParts(profile.name)
      const saved = {
        firstName: profile.first_name ?? returnedName.firstName,
        lastName: profile.last_name ?? returnedName.lastName,
      }
      setSavedName(saved)
      setFirstName(saved.firstName)
      setLastName(saved.lastName)
      notify({ title: m.profile_name_saved() })
    } catch (error) {
      notify({
        tone: 'error',
        title: m.notification_save_error(),
        description: getErrorMessage(error),
      })
    }
  }

  return (
    <SectionShell
      id={SETTINGS_ANCHORS.changeName}
      title={m.settings_change_name()}
      description={m.settings_change_name_desc()}
      canManage
    >
      <form
        onSubmit={submit}
        aria-busy={changeName.isPending}
        className="bg-card plate-shadow grid items-end gap-3 rounded-xl p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:p-5"
      >
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-muted text-[11px] font-medium">
            {m.profile_first_name()}
          </span>
          <input
            autoComplete="off"
            required
            value={firstName}
            disabled={changeName.isPending}
            onChange={(event) => setFirstName(event.target.value)}
            className="well-shadow bg-chip h-9 min-w-0 rounded-lg px-3 text-[12.5px] disabled:opacity-60"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-muted text-[11px] font-medium">
            {m.profile_last_name()}
          </span>
          <input
            autoComplete="off"
            required
            value={lastName}
            disabled={changeName.isPending}
            onChange={(event) => setLastName(event.target.value)}
            className="well-shadow bg-chip h-9 min-w-0 rounded-lg px-3 text-[12.5px] disabled:opacity-60"
          />
        </label>
        <button
          type="submit"
          disabled={!canSave}
          className="bg-accent text-accent-ink h-9 justify-self-end rounded-lg px-4 text-[12px] font-semibold disabled:opacity-50"
        >
          {changeName.isPending ? m.act_saving() : m.act_save()}
        </button>
      </form>
    </SectionShell>
  )
}
