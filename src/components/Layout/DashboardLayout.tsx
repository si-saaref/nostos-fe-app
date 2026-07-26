import { Outlet } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'

export const DashboardLayout = () => (
  <div className="min-h-screen bg-gray-50">
    <Navbar />
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Outlet />
    </main>
  </div>
)
