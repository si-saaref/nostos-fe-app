import { Link } from 'react-router-dom'

export const NotFoundPage = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-3">
    <h1 className="text-3xl font-bold">404</h1>
    <p className="text-gray-600">Page not found.</p>
    <Link to="/dashboard" className="text-blue-600 underline">
      Go to dashboard
    </Link>
  </div>
)
