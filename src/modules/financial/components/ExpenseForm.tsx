import { useForm } from 'react-hook-form'
import { useCreateExpense } from '@/api/mutations/useCreateExpense'
import { useExpenseTypes } from '@/api/queries/expenseTypes'
import { usePaymentSources } from '@/api/queries/paymentSources'
import { useUsers } from '@/api/queries/users'
import { useHousehold } from '@/contexts/useHousehold'
import { useSettings } from '@/contexts/useSettings'
import { getErrorMessage } from '@/utils/errors'
import { isoDay } from '@/utils/dates'
import type { CreateExpenseInput } from '@/types/expense'

interface Props {
  onSuccess?: () => void
  onCancel?: () => void
}

/**
 * Create is open to every member — the permission matrix gates update and
 * delete, not recording what you just paid for. Six fields, because capture
 * has to be faster than remembering.
 */
export const ExpenseForm = ({ onSuccess, onCancel }: Props) => {
  const { householdId, user } = useHousehold()
  const { t } = useSettings()
  const {
    mutate: createExpense,
    isPending,
    error,
  } = useCreateExpense(householdId)
  const { data: types } = useExpenseTypes(householdId)
  const { data: sources } = usePaymentSources(householdId)
  const { data: users } = useUsers(householdId)

  const today = isoDay(new Date())

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
      datePaid: today,
      paidByUserId: user?.id ?? '',
    },
  })

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
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Field label={t('form.name')} error={errors.name?.message}>
        <input
          className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          {...register('name', { required: t('form.err.name') })}
        />
      </Field>

      <Field label={t('form.amount')} error={errors.value?.message}>
        <input
          type="number"
          inputMode="numeric"
          className="well-shadow bg-chip tnum w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          {...register('value', {
            required: t('form.err.amount'),
            valueAsNumber: true,
            min: { value: 1, message: t('form.err.positive') },
          })}
        />
      </Field>

      <Field label={t('form.date')} error={errors.datePaid?.message}>
        <input
          type="date"
          max={today}
          className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          {...register('datePaid', {
            required: t('form.err.date'),
            validate: (value) => value <= today || t('form.err.future'),
          })}
        />
      </Field>

      <Field label={t('form.category')} error={errors.typeId?.message}>
        <select
          className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          {...register('typeId', { required: t('form.err.category') })}
        >
          <option value="">{t('form.choose')}</option>
          {types?.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t('form.method')} error={errors.sourceId?.message}>
        <select
          className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          {...register('sourceId', { required: t('form.err.method') })}
        >
          <option value="">{t('form.choose')}</option>
          {sources?.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t('form.paidBy')} error={errors.paidByUserId?.message}>
        <select
          className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          {...register('paidByUserId', { required: true })}
        >
          {users?.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </Field>

      {error && (
        <p
          role="alert"
          className="text-danger text-[11px] sm:col-span-2 lg:col-span-3"
        >
          {getErrorMessage(error)}
        </p>
      )}

      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-accent text-accent-ink rounded-lg px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
        >
          {isPending ? t('form.saving') : t('form.submit')}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="border-hair text-muted rounded-lg border px-4 py-2 text-[12px] font-semibold"
          >
            {t('form.cancel')}
          </button>
        )}
      </div>
    </form>
  )
}

const Field = ({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) => (
  <label className="flex flex-col gap-1">
    <span className="text-muted text-[9px] font-bold tracking-[0.11em] uppercase">
      {label}
    </span>
    {children}
    {error && (
      <span role="alert" className="text-danger text-[10.5px]">
        {error}
      </span>
    )}
  </label>
)
