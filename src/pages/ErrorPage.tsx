import { useRouteError } from 'react-router-dom'
import { getErrorMessage } from '@/utils/errors'

export const ErrorPage = () => {
  const error = useRouteError()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-gray-600">{getErrorMessage(error)}</p>
    </div>
  )
}
