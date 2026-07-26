import { useForm } from 'react-hook-form'
import { useCreateExpense } from '@/api/mutations/useCreateExpense'
import { useExpenseTypes } from '@/api/queries/expenseTypes'
import { usePaymentSources } from '@/api/queries/paymentSources'
import { useHousehold } from '@/contexts/useHousehold'
import { canManageExpenses } from '@/utils/permissions'
import { getErrorMessage } from '@/utils/errors'
import type { CreateExpenseInput } from '@/types/expense'

interface Props {
  onSuccess?: () => void
}

const today = () => new Date().toISOString().slice(0, 10)

export const ExpenseForm = ({ onSuccess }: Props) => {
  const { householdId, role, user } = useHousehold()
  const { mutate: createExpense, isPending, error } = useCreateExpense(householdId)
  const { data: types } = useExpenseTypes(householdId)
  const { data: sources } = usePaymentSources(householdId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateExpenseInput>({
    defaultValues: {
      name: '',
      value: 0,
      typeId: '',
      sourceId: '',
      datePaid: today(),
      paidByUserId: user?.id ?? '',
    },
  })

  if (!canManageExpenses(role)) {
    return <p className="text-sm text-gray-500">Only admins can add expenses.</p>
  }

  const onSubmit = (data: CreateExpenseInput) => {
    createExpense(
      { ...data, value: Number(data.value) },
      {
        onSuccess: () => {
          reset()
          onSuccess?.()
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          className="rounded border border-gray-300 px-3 py-2"
          {...register('name', { required: 'Name is required' })}
        />
        {errors.name && (
          <span role="alert" className="text-xs text-red-600">
            {errors.name.message}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Amount
        <input
          type="number"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('value', {
            required: 'Amount is required',
            valueAsNumber: true,
            min: { value: 1, message: 'Must be positive' },
          })}
        />
        {errors.value && (
          <span role="alert" className="text-xs text-red-600">
            {errors.value.message}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Type
        <select
          className="rounded border border-gray-300 px-3 py-2"
          {...register('typeId', { required: 'Type is required' })}
        >
          <option value="">Select type</option>
          {types?.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
        {errors.typeId && (
          <span role="alert" className="text-xs text-red-600">
            {errors.typeId.message}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Source
        <select
          className="rounded border border-gray-300 px-3 py-2"
          {...register('sourceId', { required: 'Source is required' })}
        >
          <option value="">Select source</option>
          {sources?.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
        {errors.sourceId && (
          <span role="alert" className="text-xs text-red-600">
            {errors.sourceId.message}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Date paid
        <input
          type="date"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('datePaid', { required: 'Date is required' })}
        />
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
        {isPending ? 'Saving…' : 'Add expense'}
      </button>
    </form>
  )
}
