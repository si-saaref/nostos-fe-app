import { useEffect, useRef, useState } from 'react'
import { useMessages } from '@/i18n/useMessages'
import { Select } from '@/components/Select'
import { useActiveCategories } from '@/modules/settings/api/categories'
import { useActiveAccounts } from '@/modules/settings/api/accounts'
import { useRoster } from '@/modules/settings/api/members'
import { rimFor } from '@/theme/rims'
import type { ExpenseFilters } from '@/types/expense'

interface Props {
  householdId: string
  filters: ExpenseFilters
  onChange: (next: Partial<ExpenseFilters>) => void
  onClear: () => void
  isNarrowed: boolean
}

/** Long enough to finish a word, short enough to feel like typing. */
const SEARCH_DEBOUNCE_MS = 300

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
  const { data: categories } = useActiveCategories(householdId)
  const { data: accounts } = useActiveAccounts(householdId)
  const { data: users } = useRoster(householdId)

  // Search is part of the query key and of the URL, so an undebounced keystroke
  // was a request and a new cache entry each. Typing "belanja" cost seven of
  // both.
  const committedSearch = filters.search ?? ''
  const [searchDraft, setSearchDraft] = useState(committedSearch)
  const [lastCommitted, setLastCommitted] = useState(committedSearch)
  const debounceRef = useRef<number | undefined>(undefined)

  // Clearing the filters, or arriving on a shared URL, wins over an unsent
  // keystroke. Adjusted during render rather than in an effect, so the input
  // never paints one frame with the stale value.
  if (lastCommitted !== committedSearch) {
    setLastCommitted(committedSearch)
    setSearchDraft(committedSearch)
  }

  const onSearchInput = (value: string) => {
    setSearchDraft(value)
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(
      () => onChange({ search: value || undefined, page: 1 }),
      SEARCH_DEBOUNCE_MS,
    )
  }

  useEffect(() => () => window.clearTimeout(debounceRef.current), [])

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="well-shadow bg-chip flex min-w-[180px] flex-1 items-center rounded-lg px-3 py-2">
        <span className="sr-only">{m.filter_search()}</span>
        <input
          type="search"
          value={searchDraft}
          placeholder={m.filter_search()}
          onChange={(event) => onSearchInput(event.target.value)}
          className="text-ink placeholder:text-muted w-full bg-transparent text-[11.5px] font-medium outline-none"
        />
      </label>

      <Select
        hideLabel
        label={m.filter_category()}
        placeholder={m.filter_category()}
        value={filters.typeId ?? ''}
        onChange={(value) => onChange({ typeId: value || undefined, page: 1 })}
        // Rim comes from the category's own order, never its index in this
        // array: an archived row filtered out here would otherwise shift the
        // colour of every category after it.
        options={
          categories?.map((category) => ({
            value: category.id,
            label: category.name,
            rim: rimFor(category.order),
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
          accounts?.map((account) => ({
            value: account.id,
            label: account.name,
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
