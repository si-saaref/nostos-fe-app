import { useMemo, useState } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { Controller, useForm } from 'react-hook-form'
import {
  useCreateExpense,
  useUpdateExpense,
} from '@/modules/financial/api/expenses'
import { expenseFieldErrors } from '@/modules/financial/lib/expenseErrors'
import type { ExpenseField } from '@/modules/financial/lib/expenseErrors'
import { useActiveCategories } from '@/modules/settings/api/categories'
import { useActiveAccounts } from '@/modules/settings/api/accounts'
import { useActivePayers, useRoster } from '@/modules/settings/api/members'
import { useHousehold } from '@/contexts/useHousehold'
import { getErrorMessage } from '@/utils/errors'
import { MONEY_MIN, MONEY_STEP, isValidMoney } from '@/utils/money'
import { isoDay } from '@/utils/dates'
import { Select } from '@/components/Select'
import { FormField } from '@/components/FormField'
import { rimFor } from '@/theme/rims'
import type { CreateExpenseInput, Expense } from '@/types/expense'

interface Props {
  /**
   * The row being corrected. Absent means this is a new entry.
   *
   * One form for both rather than two that drift: the six fields, their
   * validation, their pickers and the 422 field-error handling are identical.
   * The only real differences are which mutation submit runs and who may
   * reach it.
   */
  expense?: Expense
  onSuccess?: () => void
  onCancel?: () => void
}

/**
 * The server's own cap (PRD AC1.2). Enforced with `maxLength` rather than a
 * validation message: a description is trimmed as it is typed, not rejected
 * after the fact, and nothing here is worth losing to a length error.
 */
const NAME_MAX = 100

/**
 * Create is open to every member — the permission matrix gates update and
 * delete, not recording what you just paid for. Six fields, because capture
 * has to be faster than remembering.
 *
 * Every rule renders where it applies: a required field that blocks submission
 * without saying so reads as a broken button, and three of the six fields here
 * are Selects.
 */
export const ExpenseForm = ({ expense, onSuccess, onCancel }: Props) => {
  const m = useMessages()
  const { householdId, me } = useHousehold()
  const isEdit = expense !== undefined
  const create = useCreateExpense(householdId)
  const update = useUpdateExpense(householdId)
  const { isPending, error } = isEdit ? update : create
  const { data: categories } = useActiveCategories(householdId)
  const { data: accounts } = useActiveAccounts(householdId)
  const { data: activePayers } = useActivePayers(householdId)
  const { data: roster } = useRoster(householdId)

  /**
   * Live members, plus whoever this row is already attributed to.
   *
   * A new expense may only name someone still in the household. An existing
   * one may already name someone who has left — and an admin correcting the
   * amount must not silently reattribute it by opening the form (PRD AC3.3).
   * So a departed payer stays selectable on their own row and nowhere else.
   */
  const users = useMemo(() => {
    const live = activePayers ?? []
    const current = expense?.paidByUserId
    if (!current || live.some((user) => user.id === current)) return live
    const departed = roster?.find((user) => user.id === current)
    return departed ? [...live, departed] : live
  }, [activePayers, roster, expense])

  const today = isoDay(new Date())

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<CreateExpenseInput>({
    defaultValues: {
      name: expense?.name ?? '',
      value: expense?.value ?? 0,
      typeId: expense?.typeId ?? '',
      sourceId: expense?.sourceId ?? '',
      datePaid: expense?.datePaid ?? today,
      paidByUserId: expense?.paidByUserId ?? me?.user_id ?? '',
    },
  })

  // Whether the last failure landed on a field. The summary line stands down
  // when it did — a field error plus a summary says the same thing twice.
  const [handledOnField, setHandledOnField] = useState(false)

  /** Shared by both mutations: the 422 codes are the same either way. */
  const onError = (failure: unknown) => {
    const fieldErrors = expenseFieldErrors(failure)
    fieldErrors.forEach(({ field, message }) => {
      setError(field, { type: 'server', message })
    })
    setHandledOnField(fieldErrors.length > 0)
  }

  const onSubmit = (data: CreateExpenseInput) => {
    const input = { ...data, value: Number(data.value) }
    if (isEdit) {
      // No `reset()` on an edit: the panel closes, and clearing the fields
      // first shows the admin a blank form for a frame.
      update.mutate(
        { id: expense.id, ...input },
        {
          onSuccess: () => {
            setHandledOnField(false)
            onSuccess?.()
          },
          onError,
        },
      )
      return
    }
    create.mutate(input, {
      onSuccess: () => {
        setHandledOnField(false)
        reset()
        onSuccess?.()
      },
      onError,
    })
  }

  /**
   * A server field error survives until the member acts on it. RHF does not
   * clear a `setError` error on change under the default `onSubmit` mode, so
   * each Select clears its own — otherwise a rejected category stays marked
   * after being corrected.
   *
   * `handledOnField` is deliberately not reset here. It describes the last
   * *submission*, and the mutation's `error` outlives the edit: clearing the
   * flag would pull the same message back into the summary line the moment the
   * field stopped showing it.
   */
  const changeAndClear =
    (field: ExpenseField, onChange: (value: string) => void) =>
    (value: string) => {
      clearErrors(field)
      onChange(value)
    }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <FormField label={m.form_name()} error={errors.name?.message}>
        <input
          maxLength={NAME_MAX}
          className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          {...register('name', { required: m.form_err_name() })}
        />
      </FormField>

      <FormField label={m.form_amount()} error={errors.value?.message}>
        <input
          type="number"
          inputMode="decimal"
          step={MONEY_STEP}
          min={MONEY_MIN}
          className="well-shadow bg-chip tnum w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          {...register('value', {
            required: m.form_err_amount(),
            valueAsNumber: true,
            // `min: 1` used to sit here, which silently made a split bill
            // unrecordable: the API takes two decimal places, so 50000.50 is a
            // valid amount and 0.01 is the real floor. One predicate rather
            // than two rules, so "0" and "10.999" each get the message that
            // names their own problem. No ceiling — BE's cap is twelve digits
            // (deviation #6) and not ours to enforce.
            validate: (value) =>
              !Number.isFinite(value) || value < MONEY_MIN
                ? m.form_err_positive()
                : isValidMoney(value) || m.form_err_decimals(),
          })}
        />
      </FormField>

      <FormField label={m.form_date()} error={errors.datePaid?.message}>
        <input
          type="date"
          max={today}
          className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          {...register('datePaid', {
            required: m.form_err_date(),
            validate: (value) => value <= today || m.form_err_future(),
          })}
        />
      </FormField>

      <Controller
        control={control}
        name="typeId"
        rules={{ required: m.form_err_category() }}
        render={({ field, fieldState }) => (
          <Select
            label={m.form_category()}
            placeholder={m.form_choose()}
            value={field.value}
            onChange={changeAndClear('typeId', field.onChange)}
            error={fieldState.error?.message}
            options={
              categories?.map((category) => ({
                value: category.id,
                label: category.name,
                rim: rimFor(category.order),
              })) ?? []
            }
          />
        )}
      />

      <Controller
        control={control}
        name="sourceId"
        rules={{ required: m.form_err_method() }}
        render={({ field, fieldState }) => (
          <Select
            label={m.form_method()}
            placeholder={m.form_choose()}
            value={field.value}
            onChange={changeAndClear('sourceId', field.onChange)}
            error={fieldState.error?.message}
            options={
              accounts?.map((account) => ({
                value: account.id,
                label: account.name,
              })) ?? []
            }
          />
        )}
      />

      <Controller
        control={control}
        name="paidByUserId"
        rules={{ required: m.form_err_paid_by() }}
        render={({ field, fieldState }) => (
          <Select
            label={m.form_paid_by()}
            value={field.value}
            onChange={changeAndClear('paidByUserId', field.onChange)}
            error={fieldState.error?.message}
            options={
              users?.map((member) => ({
                value: member.id,
                label: member.name,
              })) ?? []
            }
          />
        )}
      />

      {error && !handledOnField && (
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
          {isPending
            ? m.form_saving()
            : isEdit
              ? m.form_submit_edit()
              : m.form_submit()}
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
