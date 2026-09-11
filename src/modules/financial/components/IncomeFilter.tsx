import { useMessages } from '@/i18n/useMessages'
import { Select } from '@/components/Select'
import { useIncomeTypes } from '@/modules/settings/api/incomeTypes'
import type { IncomeFilters } from '@/types/income'

interface Props {
  householdId: string
  filters: IncomeFilters
  onChange: (next: Partial<IncomeFilters>) => void
}

/**
 * Narrowing the statement by income type.
 *
 * The list route takes no `type_id` yet, so this filters the rows the page is
 * already holding rather than asking the server for a narrower set — honest
 * only because the month is fetched whole, and guarded as such by the page
 * that owns the figures. Server-side narrowing is requested in
 * `notes/FE-App/API-CHANGES-2026-09-10.md`; when it lands, only this file and
 * `useIncomeFilters` move.
 *
 * Named for the width it currently has — "All types", not "Type" — the same
 * rule the expense filter row follows.
 */
export const IncomeFilter = ({ householdId, filters, onChange }: Props) => {
  const m = useMessages()
  const { data: types } = useIncomeTypes(householdId)

  return (
    <Select
      hideLabel
      label={m.filter_type()}
      placeholder={m.count_scope_all({ what: m.count_types() })}
      value={filters.typeId ?? ''}
      onChange={(value) => onChange({ typeId: value || undefined, page: 1 })}
      options={
        types
          ?.filter((type) => !type.archivedAt || type.id === filters.typeId)
          .map((type) => ({ value: type.id, label: type.name })) ?? []
      }
    />
  )
}
