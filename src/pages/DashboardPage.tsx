import { useHousehold } from '@/contexts/useHousehold'

export const DashboardPage = () => {
  const { user } = useHousehold()
  return (
    <section>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-gray-600">Welcome back, {user?.name ?? 'there'}.</p>
    </section>
  )
}
