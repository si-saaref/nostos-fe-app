import { m as messages } from '@/paraglide/messages.js'
import { useMessages } from '@/i18n/useMessages'
import { SETTINGS_ANCHORS, settingsHref } from '@/modules/settings/anchors'
import { Link, NavLink } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { useHousehold } from '@/contexts/useHousehold'
import { useLogout } from '@/modules/auth/api/logout'

interface NavItem {
  to: string
  label: () => string
  icon: string
}

/** Shipped routes. */
const LIVE: NavItem[] = [
  {
    to: '/dashboard',
    label: messages.nav_dashboard,
    icon: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  },
  {
    to: '/expenses',
    label: messages.nav_expenses,
    icon: 'M4 6h16v12H4zM4 10h16M8 14h5',
  },
  {
    to: '/income',
    label: messages.nav_income,
    icon: 'M12 20V4M5 11l7-7 7 7',
  },
  {
    to: '/calendar',
    label: messages.nav_calendar,
    icon: 'M7 3v3m10-3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v13H4V7a1 1 0 0 1 1-1zM8 13h2m4 0h2m-8 4h2m4 0h2',
  },
  {
    to: '/settings',
    label: messages.nav_settings,
    icon: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 12h2m13 0h2M12 3.5v2m0 13v2',
  },
]

/**
 * Planned modules, shown so the shape of the product is legible — and marked
 * unavailable rather than presented as working links.
 */
interface PlannedItem {
  id: string
  label: () => string
  icon: string
}

const PLANNED: PlannedItem[] = [
  {
    id: 'savings',
    label: messages.nav_savings,
    icon: 'M4 19V9m5 10V5m5 14v-7m5 7V8',
  },
  {
    id: 'plan',
    label: messages.nav_plan,
    icon: 'M12 6v6l4 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  },
]

/** Door with an arrow leaving it — the same 1.6 stroke as the nav glyphs. */
const SIGNOUT_ICON =
  'M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M9 8l-4 4 4 4M5 12h9'

const Glyph = ({ path }: { path: string }) => (
  <svg
    viewBox="0 0 24 24"
    width="17"
    height="17"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="shrink-0"
  >
    <path d={path} />
  </svg>
)

/**
 * Desktop rail. Nav moved off the top bar because the product is growing to
 * five modules, and because a centred top bar was wasting the full width the
 * ledger wants.
 */
export const Sidebar = () => {
  const m = useMessages()
  const { me } = useHousehold()
  const logout = useLogout()

  return (
    <aside className="bg-card hidden h-screen w-64 shrink-0 flex-col shadow-[1px_0_0_var(--hair)] lg:flex">
      <div className="px-4 py-4">
        <Logo />
      </div>

      <nav aria-label={m.nav_menu()} className="flex-1 overflow-y-auto px-2.5">
        <ul className="flex flex-col gap-0.5">
          {LIVE.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium ${
                    isActive
                      ? 'bg-chip text-ink font-semibold'
                      : 'text-muted hover:text-ink'
                  }`
                }
              >
                <Glyph path={item.icon} />
                {item.label()}
              </NavLink>
            </li>
          ))}
        </ul>

        <p className="text-muted mt-5 mb-1.5 px-2.5 text-[9px] font-bold tracking-[0.13em] uppercase">
          {m.nav_soon()}
        </p>
        <ul className="flex flex-col gap-0.5">
          {PLANNED.map((item) => (
            <li key={item.id}>
              <span
                aria-disabled="true"
                title={m.nav_soon_hint()}
                className="text-muted/60 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium"
              >
                <Glyph path={item.icon} />
                {item.label()}
              </span>
            </li>
          ))}
        </ul>
      </nav>

      {/* Sign out rides beside the name rather than under it: it is the one
          action here, and a second full-width row read as a second
          destination. */}
      <div className="border-hair relative mt-2 border-t">
        <Link
          to={settingsHref(SETTINGS_ANCHORS.household)}
          className="hover:bg-chip flex items-center gap-2.5 py-3 pr-12 pl-3"
        >
          <span
            aria-hidden="true"
            className="bg-accent text-accent-ink grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10px] font-bold"
          >
            {(me?.name ?? 'NN').slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-semibold">
              {me?.name}
            </span>
            <span className="text-muted block truncate text-[10.5px]">
              {me?.household_name}
            </span>
          </span>
        </Link>

        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          aria-label={m.act_signout()}
          title={m.act_signout()}
          className="text-muted hover:bg-chip hover:text-ink absolute top-1/2 right-2.5 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg disabled:opacity-60"
        >
          <Glyph path={SIGNOUT_ICON} />
        </button>
      </div>
    </aside>
  )
}

/** Mobile: the same destinations as a thumb-reachable tab bar. */
export const BottomBar = () => {
  const m = useMessages()
  return (
    <nav
      aria-label={m.nav_menu()}
      className="bg-card fixed inset-x-0 bottom-0 z-20 flex shadow-[0_-1px_0_var(--hair)] lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {LIVE.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2 text-[10px] font-semibold ${
              isActive ? 'text-accent' : 'text-muted'
            }`
          }
        >
          <Glyph path={item.icon} />
          <span className="max-w-full truncate">{item.label()}</span>
        </NavLink>
      ))}
    </nav>
  )
}
