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
}

/** Long enough to finish a word, short enough to feel like typing. */
const SEARCH_DEBOUNCE_MS = 300

/**
 * Filter fields are the one place a pressed-in shadow is semantically honest:
 * a well you type into. Everything else in the app lifts; these sink.
 *
 * Each control names the width it currently has — "All categories", not
 * "Category". A field label states what the control is about; this states what
 * the ledger below is showing, which is the thing you actually need to read
 * back. Clearing happens on the count strip, where the scope is declared.
 */
export const ExpenseFilter = ({ householdId, filters, onChange }: Props) => {
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
    <div className="flex flex-wrap items-center gap-2">
      <label className="well-shadow bg-chip focus-within:ring-accent/45 flex min-w-[180px] flex-1 items-center gap-2 rounded-lg px-3 py-2 focus-within:ring-1">
        <span className="sr-only">{m.filter_search()}</span>
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className="text-muted shrink-0"
        >
          <circle
            cx="5"
            cy="5"
            r="3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M7.7 7.7L11 11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
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
        placeholder={m.count_scope_all({ what: m.count_categories() })}
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
        placeholder={m.count_scope_all({ what: m.count_methods() })}
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
        placeholder={m.count_scope_all({ what: m.count_members() })}
        value={filters.paidByUserId ?? ''}
        onChange={(value) =>
          onChange({ paidByUserId: value || undefined, page: 1 })
        }
        options={
          users?.map((user) => ({ value: user.id, label: user.name })) ?? []
        }
      />
    </div>
  )
}
