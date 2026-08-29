import { m } from '@/paraglide/messages.js'
import { NavLink } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { useHousehold } from '@/contexts/useHousehold'
import { useSettings } from '@/contexts/useSettings'
import { LANGS } from '@/i18n/locales'
import type { Lang } from '@/i18n/locales'
import { THEMES } from '@/theme/themes'
import type { ThemeId } from '@/theme/themes'

interface Item {
  to: string
  label: () => string
  icon: string
}

/** Shipped routes. */
const LIVE: Item[] = [
  {
    to: '/dashboard',
    label: m.nav_dashboard,
    icon: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  },
  {
    to: '/financial/expenses',
    label: m.nav_expenses,
    icon: 'M4 6h16v12H4zM4 10h16M8 14h5',
  },
  {
    to: '/settings',
    label: m.nav_settings,
    icon: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 12h2m13 0h2M12 3.5v2m0 13v2',
  },
]

/**
 * Planned modules, shown so the shape of the product is legible — and marked
 * unavailable rather than presented as working links.
 */
const PLANNED: Array<{ label: () => string; icon: string }> = [
  { label: m.nav_income, icon: 'M12 20V4M5 11l7-7 7 7' },
  { label: m.nav_savings, icon: 'M4 19V9m5 10V5m5 14v-7m5 7V8' },
  {
    label: m.nav_plan,
    icon: 'M7 3v3m10-3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v13H4V7a1 1 0 0 1 1-1z',
  },
]

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
  const { theme, setTheme, lang, setLang } = useSettings()
  const { household, user } = useHousehold()

  return (
    <aside className="bg-card hidden h-screen w-56 shrink-0 flex-col shadow-[1px_0_0_var(--hair)] lg:flex">
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
            <li key={item.label()}>
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

      <div className="border-hair flex flex-col gap-2 border-t px-2.5 py-3">
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="theme-select">
            {m.theme_label()}
          </label>
          <select
            id="theme-select"
            value={theme}
            onChange={(event) => setTheme(event.target.value as ThemeId)}
            className="well-shadow bg-chip text-muted min-w-0 flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium outline-none"
          >
            {THEMES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="lang-select">
            {m.lang_label()}
          </label>
          <select
            id="lang-select"
            value={lang}
            onChange={(event) => setLang(event.target.value as Lang)}
            className="well-shadow bg-chip text-muted rounded-lg px-2 py-1.5 text-[11px] font-medium outline-none"
          >
            {LANGS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.id.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 px-0.5 pt-1">
          <span
            aria-hidden="true"
            className="bg-accent text-accent-ink grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[9.5px] font-bold"
          >
            {(user?.name ?? 'NN').slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[11.5px] font-semibold">
              {user?.name}
            </span>
            <span className="text-muted block truncate text-[10px]">
              {household?.name}
            </span>
          </span>
        </div>
      </div>
    </aside>
  )
}

/** Mobile: the same destinations as a thumb-reachable tab bar. */
export const BottomBar = () => {
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
            `flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-semibold ${
              isActive ? 'text-accent' : 'text-muted'
            }`
          }
        >
          <Glyph path={item.icon} />
          {item.label()}
        </NavLink>
      ))}
    </nav>
  )
}
