import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useMessages } from '@/i18n/useMessages'
import {
  useCreateIncome,
  useUpdateIncome,
} from '@/modules/financial/api/income'
import { incomeFieldErrors } from '@/modules/financial/lib/incomeErrors'
import { useActiveAccounts } from '@/modules/settings/api/accounts'
import { useIncomeTypes } from '@/modules/settings/api/incomeTypes'
import { useHousehold } from '@/contexts/useHousehold'
import { SETTINGS_ANCHORS, settingsHref } from '@/modules/settings/anchors'
import { BLOCKERS_ID, FormBlockers } from '@/components/FormBlockers'
import { FormField } from '@/components/FormField'
import { Select } from '@/components/Select'
import { getErrorMessage } from '@/utils/errors'
import { MONEY_MIN, MONEY_STEP, isValidMoney } from '@/utils/money'
import { isoDay } from '@/utils/dates'
import { rimFor } from '@/theme/rims'
import type { Blocker } from '@/components/FormBlockers'
import type { IncomeField } from '@/modules/financial/lib/incomeErrors'
import type { CreateIncomeInput, Income } from '@/types/income'

interface Props {
  /** The row being corrected. Absent means this is a new entry. */
  income?: Income
  onSuccess?: () => void
  onCancel?: () => void
}

/** The server's own cap (PRD §5). Trimmed as it is typed, not rejected after. */
const NAME_MAX = 100

/**
 * Six fields, and one of them is optional in a way that carries the whole
 * meaning of the record: leaving **From source** empty is how a member says
 * the money came from outside the household. So it is a real choice in the
 * picker with a label of its own, never a blank the member has to infer.
 *
 * Create is open to every member; the permission matrix gates update and
 * delete. One form for both, because the fields, the validation and the field
 * error handling are identical and would drift if copied.
 */
export const IncomeForm = ({ income, onSuccess, onCancel }: Props) => {
  const m = useMessages()
  const { householdId } = useHousehold()
  const isEdit = income !== undefined
  const create = useCreateIncome(householdId)
  const update = useUpdateIncome(householdId)
  const { isPending, error } = isEdit ? update : create
  const { data: accounts } = useActiveAccounts(householdId)
  const { data: types } = useIncomeTypes(householdId)

  const today = isoDay(new Date())

  /**
   * Live types to choose from, plus the one this row already carries even if
   * the household has since archived it.
   *
   * An admin correcting an amount must not silently retype the entry as
   * something else. That is why the whole list is fetched and filtered here
   * rather than asked for pre-filtered: an archived type is absent from a live
   * list, and its option would have to be labelled with its own uuid.
   */
  const typeOptions = useMemo(() => {
    const all = types ?? []
    const live = all
      .filter((type) => !type.archivedAt)
      .map((type) => ({ value: type.id, label: type.name }))
    const current = income?.typeId
    if (!current || live.some((option) => option.value === current)) return live
    const archived = all.find((type) => type.id === current)
    return [...live, { value: current, label: archived?.name ?? current }]
  }, [types, income])

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<CreateIncomeInput>({
    defaultValues: {
      name: income?.name ?? '',
      amount: income?.amount ?? 0,
      typeId: income?.typeId ?? '',
      fromSourceId: income?.fromSourceId ?? null,
      toSourceId: income?.toSourceId ?? '',
      date: income?.date ?? today,
    },
  })

  const [handledOnField, setHandledOnField] = useState(false)

  const onError = (failure: unknown) => {
    const fieldErrors = incomeFieldErrors(failure)
    fieldErrors.forEach(({ field, message }) => {
      setError(field, { type: 'server', message })
    })
    setHandledOnField(fieldErrors.length > 0)
  }

  const onSubmit = (data: CreateIncomeInput) => {
    const input = {
      ...data,
      amount: Number(data.amount),
      // The Select trades in strings, so "no source chosen" arrives as `''`.
      // It has to reach the wire as an explicit null: on this field null is a
      // value — money from outside the household — and an empty string would
      // be a source id that does not exist.
      fromSourceId: data.fromSourceId ? data.fromSourceId : null,
    }
    if (isEdit) {
      update.mutate(
        { id: income.id, ...input },
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
   * RHF does not clear a `setError` error on change in its default mode, so
   * each Select clears its own — otherwise a rejected source stays marked
   * after being corrected. `handledOnField` is deliberately not reset: it
   * describes the last *submission*, and clearing it would pull the same
   * message back into the summary line the moment the field stopped showing it.
   */
  const changeAndClear =
    (field: IncomeField, onChange: (value: string) => void) =>
    (value: string) => {
      clearErrors(field)
      // Both sources share one message, so correcting either should clear it.
      if (field === 'fromSourceId') clearErrors('toSourceId')
      onChange(value)
    }

  const sourceOptions = (accounts ?? []).map((account) => ({
    value: account.id,
    label: account.name,
    rim: rimFor(account.order),
  }))

  /**
   * Two ways the household is not ready, handled identically — see
   * `FormBlockers`. Both wait for the list to arrive before claiming it is
   * empty: an unresolved query is not the same fact as a household with no
   * income types, and the banner would otherwise flash on every open.
   */
  const candidates: (Blocker | false)[] = [
    types !== undefined &&
      typeOptions.length === 0 && {
        id: 'types',
        text: m.inc_blocked_types(),
        fix: m.inc_blocked_types_fix(),
        href: settingsHref(SETTINGS_ANCHORS.incomeTypes),
      },
    accounts !== undefined &&
      sourceOptions.length === 0 && {
        id: 'sources',
        text: m.inc_blocked_sources(),
        fix: m.inc_blocked_sources_fix(),
        href: settingsHref(SETTINGS_ANCHORS.accounts),
      },
  ]
  const blockers = candidates.filter((b): b is Blocker => b !== false)

  const isBlocked = blockers.length > 0

  /**
   * Swallowed before validation runs, not after. Letting `handleSubmit` fire
   * would mark the empty type field "required" — the wrong problem, since
   * there is nothing to require.
   */
  const guardedSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (isBlocked) {
      event.preventDefault()
      return
    }
    void handleSubmit(onSubmit)(event)
  }

  return (
    <form
      onSubmit={guardedSubmit}
      noValidate
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <FormBlockers blockers={blockers} />

      <FormField label={m.inc_form_name()} error={errors.name?.message}>
        <input
          maxLength={NAME_MAX}
          className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          {...register('name', { required: m.inc_err_name() })}
        />
      </FormField>

      <FormField label={m.inc_form_amount()} error={errors.amount?.message}>
        <input
          type="number"
          inputMode="decimal"
          step={MONEY_STEP}
          min={MONEY_MIN}
          className="well-shadow bg-chip tnum w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          {...register('amount', {
            required: m.inc_err_amount(),
            valueAsNumber: true,
            // One predicate rather than two rules, so "0" and "10.999" each
            // get the message that names their own problem. A third decimal is
            // a rejection, not a rounding — the server rejects it too, and
            // nothing between here and there quietly fixes it.
            validate: (value) =>
              !Number.isFinite(value) || value < MONEY_MIN
                ? m.form_err_positive()
                : isValidMoney(value) || m.form_err_decimals(),
          })}
        />
      </FormField>

      <FormField label={m.inc_form_date()} error={errors.date?.message}>
        <input
          type="date"
          max={today}
          className="well-shadow bg-chip w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          {...register('date', {
            required: m.inc_err_date(),
            validate: (value) => value <= today || m.form_err_future(),
          })}
        />
      </FormField>

      <Controller
        control={control}
        name="typeId"
        rules={{ required: m.inc_err_type() }}
        render={({ field, fieldState }) => (
          <Select
            label={m.inc_form_type()}
            placeholder={m.form_choose()}
            value={field.value}
            onChange={changeAndClear('typeId', field.onChange)}
            error={fieldState.error?.message}
            disabled={typeOptions.length === 0}
            options={typeOptions}
          />
        )}
      />

      {/* Optional, and the placeholder is the meaning rather than an absence:
          "From outside the household" is a choice a member makes, not a field
          they failed to fill in. */}
      <Controller
        control={control}
        name="fromSourceId"
        render={({ field, fieldState }) => (
          <Select
            label={m.inc_form_from()}
            placeholder={m.inc_form_from_external()}
            value={field.value ?? ''}
            onChange={changeAndClear('fromSourceId', field.onChange)}
            error={fieldState.error?.message}
            hint={m.inc_form_from_hint()}
            disabled={sourceOptions.length === 0}
            options={sourceOptions}
          />
        )}
      />

      <Controller
        control={control}
        name="toSourceId"
        rules={{
          required: m.inc_err_to(),
          // Read from the second argument rather than from `watch()`: watch
          // returns a fresh function every render, which opts the whole form
          // out of React Compiler memoisation for one comparison.
          //
          // Caught here as well as by the server, because the member can see
          // both pickers at once and should not have to submit to find out
          // that money cannot move to where it already is.
          validate: (value, values) =>
            !values.fromSourceId ||
            value !== values.fromSourceId ||
            m.inc_err_same_source(),
        }}
        render={({ field, fieldState }) => (
          <Select
            label={m.inc_form_to()}
            placeholder={m.form_choose()}
            value={field.value}
            onChange={changeAndClear('toSourceId', field.onChange)}
            error={fieldState.error?.message}
            disabled={sourceOptions.length === 0}
            options={sourceOptions}
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

      {/* Right-aligned, and the submit is last: the member's eye leaves the
          final field at the right edge of the grid, so an action group at the
          far left is a journey back across the form to finish. */}
      <div className="flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="border-hair text-muted rounded-lg border px-4 py-2 text-[12px] font-semibold"
          >
            {m.form_cancel()}
          </button>
        )}
        {/* `aria-disabled` rather than `disabled`: a blocked submit is the
            one control on screen that owes an explanation, and a truly
            disabled button drops out of the tab order before it can give
            one. It stays reachable, names its reason, and does nothing. */}
        <button
          type="submit"
          disabled={isPending}
          aria-disabled={isBlocked}
          aria-describedby={isBlocked ? BLOCKERS_ID : undefined}
          className="bg-accent text-accent-ink rounded-lg px-4 py-2 text-[12px] font-semibold disabled:opacity-50 aria-disabled:opacity-50"
        >
          {isPending
            ? m.form_saving()
            : isEdit
              ? m.form_submit_edit()
              : m.form_submit()}
        </button>
      </div>
    </form>
  )
}
