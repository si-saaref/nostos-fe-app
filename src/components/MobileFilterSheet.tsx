import { useState } from 'react'
import { Dialog } from 'radix-ui'
import { Select, type SelectOption } from './Select'
import { useMessages } from '@/i18n/useMessages'

export interface FilterField {
  key: string
  label: string
  all: string
  value: string
  options: SelectOption[]
}

export const MobileFilterSheet = ({
  fields,
  onApply,
}: {
  fields: FilterField[]
  onApply: (values: Record<string, string>) => void
}) => {
  const m = useMessages()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const count = fields.filter((field) => field.value).length
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next)
          setDraft(
            Object.fromEntries(fields.map((field) => [field.key, field.value])),
          )
        setOpen(next)
      }}
    >
      <Dialog.Trigger
        aria-label={`${m.filters_title()}${count ? ` (${count})` : ''}`}
        className="bg-card text-ink border-hair relative grid h-11 w-11 shrink-0 place-items-center rounded-lg border lg:hidden"
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        >
          <path d="M4 7h16M7 12h10M10 17h4" />
        </svg>
        {count > 0 && (
          <span className="bg-accent text-accent-ink absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold">
            {count}
          </span>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[3px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="bg-card fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="font-display text-lg font-bold">
              {m.filters_title()}
            </Dialog.Title>
            <Dialog.Close
              aria-label={m.action_close()}
              className="grid h-11 w-11 place-items-center rounded-full"
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-4">
            {fields.map((field) => (
              <Select
                key={field.key}
                label={field.label}
                placeholder={field.all}
                value={draft[field.key] ?? ''}
                options={field.options}
                onChange={(value) =>
                  setDraft((previous) => ({ ...previous, [field.key]: value }))
                }
              />
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() =>
                setDraft(
                  Object.fromEntries(fields.map((field) => [field.key, ''])),
                )
              }
              className="border-hair min-h-11 flex-1 rounded-lg border px-4 text-sm font-semibold"
            >
              {m.filters_reset()}
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft)
                setOpen(false)
              }}
              className="bg-accent text-accent-ink min-h-11 flex-1 rounded-lg px-4 text-sm font-semibold"
            >
              {m.filters_apply()}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
