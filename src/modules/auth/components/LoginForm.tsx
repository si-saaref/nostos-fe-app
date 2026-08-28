import { useForm } from 'react-hook-form'
import { useLogin } from '@/modules/auth/api/useLogin'
import { getErrorMessage } from '@/utils/errors'
import type { LoginInput } from '@/modules/auth/types/auth'

interface Props {
  onSuccess?: () => void
}

export const LoginForm = ({ onSuccess }: Props) => {
  const { mutate: login, isPending, error } = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = (data: LoginInput) => {
    login(data, { onSuccess: () => onSuccess?.() })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Sign in</h1>

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('email', { required: 'Email is required' })}
        />
        {errors.email && (
          <span role="alert" className="text-xs text-red-600">
            {errors.email.message}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('password', { required: 'Password is required' })}
        />
        {errors.password && (
          <span role="alert" className="text-xs text-red-600">
            {errors.password.message}
          </span>
        )}
      </label>

      {error && (
        <p role="alert" className="text-xs text-red-600">
          {getErrorMessage(error)}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
