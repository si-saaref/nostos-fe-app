import { NavLink } from 'react-router-dom'
import { useHousehold } from '@/contexts/useHousehold'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 text-sm font-medium ${
    isActive ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
  }`

export const Navbar = () => {
  const { household } = useHousehold()
  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
        <span className="mr-4 font-semibold">
          {household?.name ?? 'Household'}
        </span>
        <NavLink to="/dashboard" className={linkClass}>
          Dashboard
        </NavLink>
        <NavLink to="/financial/expenses" className={linkClass}>
          Expenses
        </NavLink>
      </nav>
    </header>
  )
}
