import { useState, type FormEvent } from 'react'
import { apiClient } from '@/api/client'
import { useHousehold } from '@/contexts/useHousehold'
import { useNotifications } from '@/contexts/useNotifications'
import { useMessages } from '@/i18n/useMessages'
import { SETTINGS_ANCHORS } from '@/modules/settings/anchors'
import { SectionShell } from '@/modules/settings/components/SectionShell'
import { getErrorMessage } from '@/utils/errors'

export const ChangeEmailSection = () => {
  const m = useMessages()
  const { me } = useHousehold()
  const { notify } = useNotifications()
  const [newEmail, setNewEmail] = useState('')
  const [isSending, setIsSending] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const address = newEmail.trim().toLowerCase()
    if (isSending || !address || address === me?.email.toLowerCase()) return
    setIsSending(true)
    try {
      await apiClient.post('/auth/change-email', { new_email: address })
      notify({
        title: m.profile_email_sent_title(),
        description: m.profile_sent(),
        duration: 10000,
      })
    } catch (error) {
      notify({
        tone: 'error',
        title: m.profile_email_error(),
        description: getErrorMessage(error),
      })
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
      <div className="bg-card plate-shadow rounded-xl p-4 sm:p-5">
        <div className="border-hair flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-4">
          <span className="text-muted text-[11px]">{m.profile_current()}</span>
          <span className="min-w-0 text-[12.5px] font-medium break-all">
            {me?.email}
          </span>
        </div>
        <form
          onSubmit={submit}
          aria-busy={isSending}
          className="mt-4 flex flex-col gap-1.5"
        >
          <label
            htmlFor="profile-new-email"
            className="text-muted text-[11px] font-medium"
          >
            {m.profile_new_email()}
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="profile-new-email"
              type="email"
              autoComplete="off"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={newEmail}
              disabled={isSending}
              onChange={(event) => setNewEmail(event.target.value)}
              className="well-shadow bg-chip text-ink h-9 min-w-0 flex-1 rounded-lg px-3 text-[12.5px] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={
                isSending ||
                !newEmail.trim() ||
                newEmail.trim().toLowerCase() === me?.email.toLowerCase()
              }
              className="bg-accent text-accent-ink h-9 shrink-0 self-end rounded-lg px-4 text-[12px] font-semibold disabled:opacity-50"
            >
              {isSending ? m.profile_sending() : m.profile_send()}
            </button>
          </div>
        </form>
      </div>
    </SectionShell>
  )
}
