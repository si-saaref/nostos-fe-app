import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMessages } from '@/i18n/useMessages'
import { useHousehold } from '@/contexts/useHousehold'
import { CategorySection } from '@/modules/settings/components/CategorySection'
import { AccountSection } from '@/modules/settings/components/AccountSection'
import { MemberSection } from '@/modules/settings/components/MemberSection'
import { PreferencesSection } from '@/modules/settings/components/PreferencesSection'
import { SETTINGS_ANCHORS } from '@/modules/settings/anchors'
import { canManageExpenses } from '@/utils/permissions'

/**
 * Settings, scoped by what owns each setting.
 *
 * A group is a *view*, not a heading. Once the index is grouped by owner,
 * "EXPENSE" reads as a scope — so selecting it must actually narrow the page to
 * expense configuration, not merely scroll to it with household settings still
 * sitting underneath. Grouping without scoping is the junk drawer wearing a
 * table of contents.
 *
 * Within a group the sections still stack as one document with a
 * position-reporting index, the same device the expenses rail uses. That holds
 * because everything in a group shares an owner; across groups it does not.
 *
 * Each future module (Income, Investments, Plan) adds a group, never a tab bar
 * inside a section.
 */
export const SettingsPage = () => {
  const m = useMessages()
  const { householdId, household, role, user } = useHousehold()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const canManage = canManageExpenses(role)

  interface IndexEntry {
    id: string
    label: string
  }

  const groups: Array<{ label: string; sections: IndexEntry[] }> = [
    {
      label: m.group_expense(),
      sections: [
        { id: SETTINGS_ANCHORS.expenseCategories, label: m.cat_title() },
      ],
    },
    {
      label: m.group_household(),
      sections: [
        { id: SETTINGS_ANCHORS.accounts, label: m.acc_title() },
        { id: SETTINGS_ANCHORS.members, label: m.mem_title() },
        { id: SETTINGS_ANCHORS.household, label: m.pref_title() },
      ],
    },
  ]
  const flat = groups.flatMap((group) => group.sections)
  const groupOf = (anchor: string) =>
    groups.findIndex((group) =>
      group.sections.some((section) => section.id === anchor),
    )

  // The scope lives in the URL, not in state: it is then shareable, survives a
  // reload, and cannot drift out of sync with the anchor a module linked to.
  const anchor = hash.replace('#', '') || flat[0].id
  const activeGroup = Math.max(0, groupOf(anchor))
  const visible = groups[activeGroup].sections

  const scrollRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(anchor)

  const jumpTo = useCallback((id: string) => {
    setActive(id)
    scrollRef.current
      ?.querySelector(`#${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  /** Selecting a scope or a section is a navigation, so the URL always matches. */
  const goTo = useCallback(
    (id: string) => {
      navigate(`#${id}`, { replace: true })
      jumpTo(id)
    },
    [navigate, jumpTo],
  )

  // Arriving from a module's "Manage" link: the group is already derived from
  // the anchor, so this only has to scroll once the section has rendered.
  useEffect(() => {
    if (!hash) return
    const timer = window.setTimeout(() => jumpTo(hash.replace('#', '')), 140)
    return () => window.clearTimeout(timer)
  }, [hash, jumpTo])

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const nodes = visible
      .map((section) => root.querySelector(`#${section.id}`))
      .filter((node): node is Element => Boolean(node))
    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0]
        if (visible?.target.id) setActive(visible.target.id)
      },
      { root, rootMargin: '0px 0px -70% 0px', threshold: 0 },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
    // Re-observe when the visible group changes; labels changing locale must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup])

  return (
    <section className="flex h-full flex-col">
      <header className="shrink-0 px-4 pt-4 pb-3 lg:px-6">
        <h1 className="font-display text-2xl font-bold">
          {m.settings_title()}
        </h1>
        <p className="text-muted mt-1 max-w-prose text-[12px]">
          {m.settings_intro()}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 gap-5 px-4 pb-4 lg:px-6">
        <nav
          aria-label={m.settings_index()}
          className="well-shadow bg-chip hidden h-fit w-52 shrink-0 rounded-xl p-2 lg:block"
        >
          {groups.map((group, index) => {
            const isCurrentGroup = index === activeGroup
            return (
              <div key={group.label} className="mb-2 last:mb-0">
                <button
                  type="button"
                  onClick={() => goTo(group.sections[0].id)}
                  aria-current={isCurrentGroup ? 'true' : undefined}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-left text-[9px] font-bold tracking-[0.13em] uppercase ${
                    isCurrentGroup ? 'text-ink' : 'text-muted'
                  }`}
                >
                  {group.label}
                </button>
                {isCurrentGroup && (
                  <ul className="flex flex-col gap-0.5">
                    {group.sections.map((section) => (
                      <li key={section.id}>
                        <button
                          type="button"
                          onClick={() => goTo(section.id)}
                          aria-current={
                            active === section.id ? 'true' : undefined
                          }
                          className={`w-full rounded-lg px-2.5 py-2 text-left text-[12px] font-medium ${
                            active === section.id
                              ? 'bg-card text-ink font-semibold'
                              : 'text-muted'
                          }`}
                        >
                          {section.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </nav>

        <div className="min-h-0 min-w-0 flex-1">
          {/* Mobile: the same index, flattened into a scrollable chip row. */}
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {groups.map((group, index) => (
              <button
                key={group.label}
                type="button"
                onClick={() => goTo(group.sections[0].id)}
                aria-current={index === activeGroup ? 'true' : undefined}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase ${
                  index === activeGroup
                    ? 'bg-ink text-card'
                    : 'bg-chip text-muted well-shadow'
                }`}
              >
                {group.label}
              </button>
            ))}
          </div>

          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {visible.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => goTo(section.id)}
                aria-current={active === section.id ? 'true' : undefined}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold ${
                  active === section.id
                    ? 'bg-accent text-accent-ink'
                    : 'bg-chip text-muted well-shadow'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>

          <div
            ref={scrollRef}
            className="h-full overflow-y-auto pr-1 pb-24 lg:pb-4"
          >
            {activeGroup === 0 && (
              <CategorySection
                householdId={householdId}
                canManage={canManage}
              />
            )}

            {activeGroup === 1 && (
              <>
                <AccountSection
                  householdId={householdId}
                  canManage={canManage}
                />
                <MemberSection
                  householdId={householdId}
                  householdName={household?.name ?? ''}
                  canManage={canManage}
                  currentUserId={user?.id ?? ''}
                />
                <PreferencesSection
                  householdId={householdId}
                  canManage={canManage}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
