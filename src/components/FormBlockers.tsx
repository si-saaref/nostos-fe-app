import { Link } from 'react-router-dom'
import { useMessages } from '@/i18n/useMessages'

export interface Blocker {
  id: string
  /** What is missing, in the household's terms. */
  text: string
  /** The action that fixes it — the link's own label. */
  fix: string
  href: string
}

/**
 * Why a capture form cannot be submitted yet, and where to go about it.
 *
 * This is not validation. A required field is the member's to fix in place, so
 * the form lets them submit and answers on the field. A missing category or
 * payment source is the *household's* to fix in Settings: the picker has no
 * options at all, so no amount of retyping produces a valid entry. Staging a
 * submit that cannot succeed and then blaming an empty field names the wrong
 * problem (PRODUCT.md principle 5).
 *
 * So the form still renders — a form that cannot be used and will not say why
 * is the one outcome worse than either — and the submit is inert with this
 * text as its description.
 */
export const BLOCKERS_ID = 'form-blockers'

export const FormBlockers = ({ blockers }: { blockers: Blocker[] }) => {
  const m = useMessages()
  if (blockers.length === 0) return null

  return (
    <div
      id={BLOCKERS_ID}
      className="bg-chip flex flex-col gap-1 rounded-lg px-3 py-2.5 sm:col-span-2 lg:col-span-3"
    >
      {blockers.map((blocker) => (
        <p key={blocker.id} className="text-[11px]">
          <span className="font-semibold">{blocker.text}</span>{' '}
          <Link
            to={blocker.href}
            className="text-accent font-semibold underline underline-offset-2"
          >
            {blocker.fix}
          </Link>
        </p>
      ))}
      <p className="text-muted text-[10px]">{m.form_blocked_hint()}</p>
    </div>
  )
}
