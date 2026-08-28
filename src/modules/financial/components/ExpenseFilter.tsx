import { useMessages } from '@/i18n/useMessages'
import { useExpenseTypes } from '@/api/queries/expenseTypes'
import { usePaymentSources } from '@/api/queries/paymentSources'
import { useUsers } from '@/api/queries/users'
import type { ExpenseFilters } from '@/types/expense'

interface Props {
  householdId: string
  filters: ExpenseFilters
  onChange: (next: Partial<ExpenseFilters>) => void
  onClear: () => void
  isNarrowed: boolean
}

/**
 * Filter fields are the one place a pressed-in shadow is semantically honest:
 * a well you type into. Everything else in the app lifts; these sink.
 */
export const ExpenseFilter = ({
  householdId,
  filters,
  onChange,
  onClear,
  isNarrowed,
}: Props) => {
  const m = useMessages()
  const { data: types } = useExpenseTypes(householdId)
  const { data: sources } = usePaymentSources(householdId)
  const { data: users } = useUsers(householdId)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="well-shadow bg-chip flex min-w-[180px] flex-1 items-center rounded-lg px-3 py-2">
        <span className="sr-only">{m.filter_search()}</span>
        <input
          type="search"
          value={filters.search ?? ''}
          placeholder={m.filter_search()}
          onChange={(event) =>
            onChange({ search: event.target.value || undefined, page: 1 })
          }
          className="text-ink placeholder:text-muted w-full bg-transparent text-[11.5px] font-medium outline-none"
        />
      </label>

      <Select
        label={m.filter_category()}
        value={filters.typeId ?? ''}
        onChange={(value) => onChange({ typeId: value || undefined, page: 1 })}
        options={types?.map((type) => ({ id: type.id, name: type.name })) ?? []}
      />
      <Select
        label={m.filter_method()}
        value={filters.sourceId ?? ''}
        onChange={(value) =>
          onChange({ sourceId: value || undefined, page: 1 })
        }
        options={
          sources?.map((source) => ({ id: source.id, name: source.name })) ?? []
        }
      />
      <Select
        label={m.filter_paid_by()}
        value={filters.paidByUserId ?? ''}
        onChange={(value) =>
          onChange({ paidByUserId: value || undefined, page: 1 })
        }
        options={users?.map((user) => ({ id: user.id, name: user.name })) ?? []}
      />

      {isNarrowed && (
        <button
          type="button"
          onClick={onClear}
          className="border-hair text-muted rounded-lg border px-3 py-2 text-[11px] font-semibold"
        >
          {m.filter_clear()}
        </button>
      )}
    </div>
  )
}

const Select = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ id: string; name: string }>
}) => (
  <label className="well-shadow bg-chip flex items-center rounded-lg px-3 py-2">
    <span className="sr-only">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`bg-transparent text-[11.5px] font-medium outline-none ${
        value ? 'text-ink' : 'text-muted'
      }`}
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  </label>
)
