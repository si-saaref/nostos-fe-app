import { useHousehold } from '@/contexts/useHousehold'
import { useSettings } from '@/contexts/useSettings'

export const DashboardPage = () => {
  const { user, household } = useHousehold()
  const { t } = useSettings()
  return (
    <div className="h-full overflow-y-auto px-4 py-6 pb-24 lg:px-6 lg:pb-6">
      <h1 className="font-display text-2xl font-bold">{t('nav.dashboard')}</h1>
      <p className="text-muted mt-2 text-sm">
        {user?.name} · {household?.name}
      </p>
    </div>
  )
}
