import { useMessages } from '@/i18n/useMessages'
import { Select } from '@/components/Select'
import { useExpenseTypes } from '@/api/queries/expenseTypes'
import { usePaymentSources } from '@/api/queries/paymentSources'
import { useUsers } from '@/api/queries/users'
import { rimFor } from '@/types/settings'
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
    <div className="flex flex-wrap items-end gap-2">
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
        hideLabel
        label={m.filter_category()}
        placeholder={m.filter_category()}
        value={filters.typeId ?? ''}
        onChange={(value) => onChange({ typeId: value || undefined, page: 1 })}
        // The rim carries category on every ledger row, so the picker wears it too.
        options={
          types?.map((type, index) => ({
            value: type.id,
            label: type.name,
            rim: rimFor(index),
          })) ?? []
        }
      />

      <Select
        hideLabel
        label={m.filter_method()}
        placeholder={m.filter_method()}
        value={filters.sourceId ?? ''}
        onChange={(value) =>
          onChange({ sourceId: value || undefined, page: 1 })
        }
        options={
          sources?.map((source) => ({
            value: source.id,
            label: source.name,
          })) ?? []
        }
      />

      <Select
        hideLabel
        label={m.filter_paid_by()}
        placeholder={m.filter_paid_by()}
        value={filters.paidByUserId ?? ''}
        onChange={(value) =>
          onChange({ paidByUserId: value || undefined, page: 1 })
        }
        options={
          users?.map((user) => ({ value: user.id, label: user.name })) ?? []
        }
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
