import { useState, type FormEvent } from 'react'
import { useHousehold } from '@/contexts/useHousehold'
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
  const fallback = legacyNameParts(me?.name ?? '')
  const [firstName, setFirstName] = useState(
    me?.first_name ?? fallback.firstName,
  )
  const [lastName, setLastName] = useState(me?.last_name ?? fallback.lastName)
  const changeName = useChangeName()

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return
    changeName.mutate({ firstName, lastName })
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
        className="bg-card plate-shadow flex max-w-2xl flex-col gap-3 rounded-xl p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-muted text-[9px] font-bold tracking-[0.11em] uppercase">
              {m.profile_first_name()}
            </span>
            <input
              autoComplete="off"
              value={firstName}
              onChange={(event) => {
                changeName.reset()
                setFirstName(event.target.value)
              }}
              className="well-shadow bg-chip min-h-11 rounded-lg px-3 py-2 text-[12.5px] outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted text-[9px] font-bold tracking-[0.11em] uppercase">
              {m.profile_last_name()}
            </span>
            <input
              autoComplete="off"
              value={lastName}
              onChange={(event) => {
                changeName.reset()
                setLastName(event.target.value)
              }}
              className="well-shadow bg-chip min-h-11 rounded-lg px-3 py-2 text-[12.5px] outline-none"
            />
          </label>
        </div>
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={
              changeName.isPending || !firstName.trim() || !lastName.trim()
            }
            className="bg-accent text-accent-ink min-h-11 rounded-lg px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
          >
            {changeName.isPending ? m.act_saving() : m.act_save()}
          </button>
        </div>
        {changeName.isSuccess && (
          <p role="status" className="bg-chip rounded-lg px-3 py-2 text-[11px]">
            {m.profile_name_saved()}
          </p>
        )}
        {changeName.isError && (
          <p
            role="alert"
            className="border-danger-line bg-danger-bg text-danger rounded-lg border px-3 py-2 text-[11px]"
          >
            {getErrorMessage(changeName.error)}
          </p>
        )}
      </form>
    </SectionShell>
  )
}
