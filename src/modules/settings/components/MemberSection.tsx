import { useState } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { Role } from '@/types/household'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormField } from '@/components/FormField'
import { SectionShell } from '@/modules/settings/components/SectionShell'
import {
  useInviteMember,
  useMembers,
  useRemoveMember,
  useResendInvite,
} from '@/modules/settings/api/members'
import { SETTINGS_ANCHORS } from '@/modules/settings/anchors'
import { getErrorMessage } from '@/utils/errors'
import { isAsciiEmail } from '@/utils/validators'
import { memberStatus, resendsLeft } from '@/modules/settings/lib/memberStatus'
import type { Member, MemberStatus } from '@/modules/settings/types/settings'

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
    isPending: isInviting,
    error: inviteError,
  } = useInviteMember(householdId)
  const { mutate: resend, error: resendError } = useResendInvite(householdId)
  const { mutate: remove, error: removeError } = useRemoveMember(householdId)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null)

  const STATUS_LABEL: Record<MemberStatus, string> = {
    joined: m.mem_status_joined(),
    pending: m.mem_status_pending(),
    invite_expired: m.mem_status_invite_expired(),
    no_access: m.mem_status_no_access(),
    left: m.mem_status_left(),
    removed: m.mem_status_removed(),
    former: m.mem_status_former(),
  }

  const nameError =
    hasAttemptedSubmit && !name.trim() ? m.mem_err_name() : undefined
  // Includes the empty case on purpose: submitting a blank address used to be
  // blocked with nothing said, which reads as a dead button.
  const emailError =
    hasAttemptedSubmit && !isAsciiEmail(email) ? m.mem_err_email() : undefined

  const canInvite = canManage && householdActive

  return (
    <SectionShell
      id={SETTINGS_ANCHORS.members}
      title={m.mem_title()}
      description={m.mem_desc()}
      canManage={canManage}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
      actionError={resendError ?? removeError}
    >
      {canInvite && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setHasAttemptedSubmit(true)
            if (!name.trim() || !isAsciiEmail(email)) return
            invite(
              { name: name.trim(), email },
              {
                onSuccess: () => {
                  setName('')
                  setEmail('')
                  setHasAttemptedSubmit(false)
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
            <FormField
              label={m.mem_invite_name()}
              error={nameError}
              className="min-w-[150px] flex-1"
            >
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
              />
            </FormField>
            <FormField
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
            </FormField>
            <button
              type="submit"
              disabled={isInviting}
              className="bg-accent text-accent-ink mt-[18px] rounded-lg px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
            >
              {isInviting ? m.act_saving() : m.mem_invite_send()}
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
          const left = resendsLeft(member)
          // An invite exists but was never delivered, so nothing the person
          // could click was ever sent. Resending is the only recovery, and
          // without saying so the row reads as merely "Pending".
          const undelivered =
            member.inviteExpiresAt !== null && member.inviteSentAt === null
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
                {undelivered && (
                  <span className="text-danger block truncate text-[10px] font-semibold">
                    {m.mem_invite_undelivered()}
                  </span>
                )}
              </span>

              <span className="text-muted text-[10.5px] font-semibold">
                {member.role === Role.ADMIN
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

              {/* An expired invite is the state resending exists for, so the
                  control has to survive the expiry rather than vanish with it. */}
              {canManage &&
                (status === 'pending' || status === 'invite_expired') && (
                  <button
                    type="button"
                    onClick={() => resend(member.id)}
                    disabled={left <= 0}
                    title={left <= 0 ? m.mem_resend_max() : undefined}
                    className="border-hair rounded-lg border px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                  >
                    {m.mem_resend()} · {m.mem_resend_left({ n: left })}
                  </button>
                )}

              {canManage &&
                !isSelf &&
                member.role !== Role.ADMIN &&
                !member.deletedAt && (
                  <button
                    type="button"
                    onClick={() => setMemberToRemove(member)}
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
        open={Boolean(memberToRemove)}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
        title={m.mem_remove()}
        body={m.mem_remove_confirm({
          name: memberToRemove?.name ?? '',
          household: householdName,
        })}
        confirmLabel={m.mem_remove()}
        destructive
        onConfirm={() => {
          if (memberToRemove) remove(memberToRemove.id)
          setMemberToRemove(null)
        }}
      />
    </SectionShell>
  )
}
