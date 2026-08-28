import { useMessages } from '@/i18n/useMessages'
import { useHousehold } from '@/contexts/useHousehold'

export const DashboardPage = () => {
  const m = useMessages()
  const { user, household } = useHousehold()
  return (
    <div className="h-full overflow-y-auto px-4 py-6 pb-24 lg:px-6 lg:pb-6">
      <h1 className="font-display text-2xl font-bold">{m.nav_dashboard()}</h1>
      <p className="text-muted mt-2 text-sm">
        {user?.name} · {household?.name}
      </p>
    </div>
  )
}
