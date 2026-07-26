import { useExpenseTypes } from '@/api/queries/expenseTypes'
import type { ExpenseFilters } from '@/types/expense'

interface Props {
  householdId: string
  filters: ExpenseFilters
  onChange: (next: Partial<ExpenseFilters>) => void
  onClear: () => void
}

export const ExpenseFilter = ({ householdId, filters, onChange, onClear }: Props) => {
  const { data: types } = useExpenseTypes(householdId)
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Type
        <select
          className="rounded border border-gray-300 px-2 py-1"
          value={filters.typeId ?? ''}
          onChange={(event) =>
            onChange({ typeId: event.target.value || undefined, page: 1 })
          }
        >
          <option value="">All types</option>
          {types?.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={onClear}
        className="rounded border border-gray-300 px-3 py-1 text-sm"
      >
        Clear
      </button>
    </div>
  )
}
