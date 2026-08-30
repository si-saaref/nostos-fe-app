import { useState } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { ConfirmDialog } from '@/modules/settings/components/ConfirmDialog'
import { Field, SectionShell } from '@/modules/settings/components/parts'
import {
  useInviteMember,
  useMembers,
  useRemoveMember,
  useResendInvite,
} from '@/api/queries/settings'
import { getErrorMessage } from '@/utils/errors'
import { MAX_RESENDS, isAsciiEmail, memberStatus } from '@/types/settings'
import type { Member, MemberStatus } from '@/types/settings'

interface Props {
  householdId: string
  householdName: string
  canManage: boolean
  currentUserId: string
  /** Invites are impossible while the household is scheduled for deletion. */
  householdActive?: boolean
}

export const MemberSection = ({
  householdId,
  householdName,
  canManage,
  currentUserId,
  householdActive = true,
}: Props) => {
  const m = useMessages()
  const { data: members, isLoading, isError, refetch } = useMembers(householdId)
  const {
    mutate: invite,
    isPending: inviting,
    error: inviteError,
  } = useInviteMember(householdId)
  const { mutate: resend } = useResendInvite(householdId)
  const { mutate: remove } = useRemoveMember(householdId)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [removing, setRemoving] = useState<Member | null>(null)

  const STATUS_LABEL: Record<MemberStatus, string> = {
    joined: m.mem_status_joined(),
    pending: m.mem_status_pending(),
    no_access: m.mem_status_no_access(),
    left: m.mem_status_left(),
    removed: m.mem_status_removed(),
    former: m.mem_status_former(),
  }

  const nameError = touched && !name.trim() ? m.mem_err_name() : undefined
  const emailError =
    touched && email.length > 0 && !isAsciiEmail(email)
      ? m.mem_err_email()
      : undefined

  const canInvite = canManage && householdActive

  return (
    <SectionShell
      id="anggota"
      title={m.mem_title()}
      description={m.mem_desc()}
      canManage={canManage}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
    >
      {canInvite && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setTouched(true)
            if (!name.trim() || !isAsciiEmail(email)) return
            invite(
              { name: name.trim(), email },
              {
                onSuccess: () => {
                  setName('')
                  setEmail('')
                  setTouched(false)
                },
              },
            )
          }}
          noValidate
          className="bg-card plate-shadow mb-3 rounded-xl p-3"
        >
          <p className="font-display mb-2 text-[12.5px] font-bold">
            {m.mem_invite()}
          </p>
          <div className="flex flex-wrap items-start gap-2">
            <Field
              label={m.mem_invite_name()}
              error={nameError}
              className="min-w-[150px] flex-1"
            >
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
              />
            </Field>
            <Field
              label={m.mem_invite_email()}
              error={emailError}
              className="min-w-[200px] flex-[2]"
            >
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
              />
            </Field>
            <button
              type="submit"
              disabled={inviting}
              className="bg-accent text-accent-ink mt-[18px] rounded-lg px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
            >
              {inviting ? m.act_saving() : m.mem_invite_send()}
            </button>
          </div>
          <p className="text-muted mt-2 text-[10.5px] leading-relaxed">
            {m.mem_invite_note()}
          </p>
          {inviteError && (
            // 409 wording differs per case and is shown verbatim — the copy is
            // the feature, so it is never replaced with a generic message.
            <p role="alert" className="text-danger mt-2 text-[11px]">
              {getErrorMessage(inviteError)}
            </p>
          )}
        </form>
      )}

      <ul className="flex flex-col gap-1.5">
        {members?.map((member) => {
          const status = memberStatus(member)
          const isSelf = member.id === currentUserId
          const resendsLeft = MAX_RESENDS - member.resendCount
          return (
            <li
              key={member.id}
              className={`bg-card plate-shadow flex flex-wrap items-center gap-3 rounded-lg px-3 py-2.5 ${
                member.deletedAt ? 'opacity-65' : ''
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium">
                  {member.name}
                  {isSelf && ' · ' + m.mem_you()}
                </span>
                <span className="text-muted block truncate text-[10.5px]">
                  {member.email}
                </span>
              </span>

              <span className="text-muted text-[10.5px] font-semibold">
                {member.role === 'admin'
                  ? m.mem_role_admin()
                  : m.mem_role_member()}
              </span>

              {/* Never a bare glyph: the state is spelled out for assistive tech. */}
              <span
                aria-label={
                  status === 'no_access'
                    ? m.mem_status_no_access_long()
                    : STATUS_LABEL[status]
                }
                className={`bg-chip rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  status === 'joined' ? 'text-rim-1' : 'text-muted'
                }`}
              >
                {STATUS_LABEL[status]}
              </span>

              {canManage && status === 'pending' && (
                <button
                  type="button"
                  onClick={() => resend(member.id)}
                  disabled={resendsLeft <= 0}
                  title={resendsLeft <= 0 ? m.mem_resend_max() : undefined}
                  className="border-hair rounded-lg border px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                >
                  {m.mem_resend()} · {m.mem_resend_left({ n: resendsLeft })}
                </button>
              )}

              {canManage &&
                !isSelf &&
                member.role !== 'admin' &&
                !member.deletedAt && (
                  <button
                    type="button"
                    onClick={() => setRemoving(member)}
                    className="border-danger-line bg-danger-bg text-danger rounded-lg border px-3 py-1.5 text-[11px] font-semibold"
                  >
                    {m.mem_remove()}
                  </button>
                )}
            </li>
          )
        })}
      </ul>

      {/* An admin cannot leave: the API returns 409 either way, so the UI does
          not stage an action that cannot succeed. */}
      <p className="text-muted mt-3 text-[11px] leading-relaxed">
        {canManage ? m.mem_leave_admin() : m.mem_leave()}
      </p>

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={m.mem_remove()}
        body={m.mem_remove_confirm({
          name: removing?.name ?? '',
          household: householdName,
        })}
        confirmLabel={m.mem_remove()}
        destructive
        onConfirm={() => {
          if (removing) remove(removing.id)
          setRemoving(null)
        }}
      />
    </SectionShell>
  )
}
