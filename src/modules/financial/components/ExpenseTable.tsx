import { formatCurrency, formatDate } from '@/utils/formatters'
import type { Expense } from '@/types/expense'

interface Props {
  expenses: Expense[]
  isLoading?: boolean
}

export const ExpenseTable = ({ expenses, isLoading }: Props) => {
  if (isLoading) {
    return <p className="py-6 text-sm text-gray-500">Loading expenses…</p>
  }
  if (expenses.length === 0) {
    return <p className="py-6 text-sm text-gray-500">No expenses yet.</p>
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-left text-gray-500">
          <th className="py-2">Name</th>
          <th className="py-2">Amount</th>
          <th className="py-2">Date</th>
        </tr>
      </thead>
      <tbody>
        {expenses.map((expense) => (
          <tr key={expense.id} className="border-b border-gray-100">
            <td className="py-2">{expense.name}</td>
            <td className="py-2">{formatCurrency(expense.value)}</td>
            <td className="py-2">{formatDate(expense.datePaid)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
