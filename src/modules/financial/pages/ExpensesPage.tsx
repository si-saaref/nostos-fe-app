import { useState } from 'react'
import { useHousehold } from '@/contexts/useHousehold'
import { useExpenseFilters } from '@/modules/financial/hooks/useExpenseFilters'
import { ExpenseTable } from '@/modules/financial/components/ExpenseTable'
import { ExpenseFilter } from '@/modules/financial/components/ExpenseFilter'
import { ExpenseForm } from '@/modules/financial/components/ExpenseForm'

export const ExpensesPage = () => {
  const { householdId } = useHousehold()
  const { filters, updateFilters, clearFilters, data, isLoading } =
    useExpenseFilters(householdId)
  const [showForm, setShowForm] = useState(false)

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <button
          type="button"
          onClick={() => setShowForm((open) => !open)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          {showForm ? 'Close' : 'Add expense'}
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <ExpenseForm onSuccess={() => setShowForm(false)} />
        </div>
      )}

      <ExpenseFilter
        householdId={householdId}
        filters={filters}
        onChange={updateFilters}
        onClear={clearFilters}
      />

      <ExpenseTable expenses={data?.items ?? []} isLoading={isLoading} />
    </section>
  )
}
