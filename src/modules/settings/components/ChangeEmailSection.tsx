import { useState, type FormEvent } from 'react'
import { apiClient } from '@/api/client'
import { useHousehold } from '@/contexts/useHousehold'
import { useMessages } from '@/i18n/useMessages'
import { SETTINGS_ANCHORS } from '@/modules/settings/anchors'
import { SectionShell } from '@/modules/settings/components/SectionShell'
import { getErrorMessage } from '@/utils/errors'

export const ChangeEmailSection = () => {
  const m = useMessages()
  const { me } = useHousehold()
  const [newEmail, setNewEmail] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const address = newEmail.trim().toLowerCase()
    if (!address || address === me?.email.toLowerCase()) return
    setIsSending(true)
    setSent(false)
    setError(null)
    try {
      await apiClient.post('/auth/change-email', { new_email: address })
      setSent(true)
    } catch (cause) {
      setError(cause)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <SectionShell
      id={SETTINGS_ANCHORS.changeEmail}
      title={m.profile_title()}
      description={m.profile_description()}
      canManage
    >
      <div className="bg-card plate-shadow rounded-xl p-4">
        <p className="text-muted text-[11px]">{m.profile_current()}</p>
        <p className="font-display mt-1 text-[14px] font-semibold">
          {me?.email}
        </p>
        <form onSubmit={submit} className="mt-4 flex max-w-xl flex-col gap-2">
          <label
            htmlFor="profile-new-email"
            className="text-[11px] font-semibold"
          >
            {m.profile_new_email()}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="profile-new-email"
              type="email"
              autoComplete="off"
              required
              value={newEmail}
              onChange={(event) => {
                setNewEmail(event.target.value)
                setSent(false)
              }}
              className="bg-chip border-hair text-ink min-h-11 min-w-0 flex-1 rounded-lg border px-3 py-2 text-[12px]"
            />
            <button
              type="submit"
              disabled={
                isSending ||
                !newEmail.trim() ||
                newEmail.trim().toLowerCase() === me?.email.toLowerCase()
              }
              className="bg-accent text-accent-ink min-h-11 rounded-lg px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
            >
              {isSending ? m.profile_sending() : m.profile_send()}
            </button>
          </div>
        </form>
        {sent && (
          <p
            role="status"
            className="bg-chip mt-3 rounded-lg px-3 py-2 text-[11px]"
          >
            {m.profile_sent()}
          </p>
        )}
        {error != null && (
          <p
            role="alert"
            className="border-danger-line bg-danger-bg text-danger mt-3 rounded-lg border px-3 py-2 text-[11px]"
          >
            {getErrorMessage(error)}
          </p>
        )}
      </div>
    </SectionShell>
  )
}
