import { Outlet } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { BottomBar, Sidebar } from '@/components/Layout/Sidebar'
import { useHousehold } from '@/contexts/useHousehold'

/**
 * App shell. The viewport is the frame: the shell never scrolls, and each page
 * decides which of its own regions do. That is what keeps the count and the
 * month rail in place while only the ledger moves.
 */
export const DashboardLayout = () => {
  const { user } = useHousehold()
  return (
    <div className="bg-ground flex h-screen overflow-hidden">
      <a
        href="#main"
        className="bg-card text-ink sr-only rounded-lg px-4 py-2 text-sm font-semibold focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-card flex items-center justify-between px-4 py-2.5 shadow-[0_1px_0_var(--hair)] lg:hidden">
          <Logo />
          <span
            aria-hidden="true"
            className="bg-accent text-accent-ink grid h-7 w-7 place-items-center rounded-lg text-[9.5px] font-bold"
          >
            {(user?.name ?? 'NN').slice(0, 2).toUpperCase()}
          </span>
        </header>

        <main id="main" className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>

        <BottomBar />
      </div>
    </div>
  )
}
