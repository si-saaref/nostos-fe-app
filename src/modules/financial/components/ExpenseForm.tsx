import { useMessages } from '@/i18n/useMessages'
import { Controller, useForm } from 'react-hook-form'
import { useCreateExpense } from '@/api/mutations/useCreateExpense'
import { useExpenseTypes } from '@/api/queries/expenseTypes'
import { usePaymentSources } from '@/api/queries/paymentSources'
import { useUsers } from '@/api/queries/users'
import { useHousehold } from '@/contexts/useHousehold'
import { getErrorMessage } from '@/utils/errors'
import { isoDay } from '@/utils/dates'
import { Select } from '@/components/Select'
import { rimFor } from '@/types/settings'
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
  const m = useMessages()
  const { householdId, user } = useHousehold()
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
    control,
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
      noValidate
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Field label={m.form_name()} error={errors.name?.message}>
        <input
          className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          {...register('name', { required: m.form_err_name() })}
        />
      </Field>

      <Field label={m.form_amount()} error={errors.value?.message}>
        <input
          type="number"
          inputMode="numeric"
          className="well-shadow bg-chip tnum w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          {...register('value', {
            required: m.form_err_amount(),
            valueAsNumber: true,
            min: { value: 1, message: m.form_err_positive() },
          })}
        />
      </Field>

      <Field label={m.form_date()} error={errors.datePaid?.message}>
        <input
          type="date"
          max={today}
          className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          {...register('datePaid', {
            required: m.form_err_date(),
            validate: (value) => value <= today || m.form_err_future(),
          })}
        />
      </Field>

      <Controller
        control={control}
        name="typeId"
        rules={{ required: m.form_err_category() }}
        render={({ field }) => (
          <Select
            label={m.form_category()}
            placeholder={m.form_choose()}
            value={field.value}
            onChange={field.onChange}
            options={
              types?.map((type, index) => ({
                value: type.id,
                label: type.name,
                rim: rimFor(index),
              })) ?? []
            }
          />
        )}
      />

      <Controller
        control={control}
        name="sourceId"
        rules={{ required: m.form_err_method() }}
        render={({ field }) => (
          <Select
            label={m.form_method()}
            placeholder={m.form_choose()}
            value={field.value}
            onChange={field.onChange}
            options={
              sources?.map((source) => ({
                value: source.id,
                label: source.name,
              })) ?? []
            }
          />
        )}
      />

      <Controller
        control={control}
        name="paidByUserId"
        rules={{ required: true }}
        render={({ field }) => (
          <Select
            label={m.form_paid_by()}
            value={field.value}
            onChange={field.onChange}
            options={
              users?.map((member) => ({
                value: member.id,
                label: member.name,
              })) ?? []
            }
          />
        )}
      />

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
          {isPending ? m.form_saving() : m.form_submit()}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="border-hair text-muted rounded-lg border px-4 py-2 text-[12px] font-semibold"
          >
            {m.form_cancel()}
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
