type Member = {
  id: string
  name: string
  firstName?: string | null
  lastName?: string | null
}
export const compactMemberLabels = (
  members: readonly Member[],
): Map<string, string> => {
  const names = members.map((member) => {
    const parts = member.name.trim().split(/\s+/)
    return {
      id: member.id,
      full: member.name.trim() || '—',
      last: member.lastName?.trim() || parts.at(-1) || '—',
      first: member.firstName?.trim() || parts.slice(0, -1).join(' '),
    }
  })
  const unique = (label: string, get: (m: (typeof names)[number]) => string) =>
    names.filter((m) => get(m) === label).length === 1
  const initial = (m: (typeof names)[number]) =>
    `${m.last} ${m.first.charAt(0)}.`
  return new Map(
    names.map((m) => [
      m.id,
      unique(m.last, (n) => n.last)
        ? m.last
        : m.first && unique(initial(m), initial)
          ? initial(m)
          : unique(m.full, (n) => n.full)
            ? m.full
            : `${m.full} · ${m.id}`,
    ]),
  )
}
