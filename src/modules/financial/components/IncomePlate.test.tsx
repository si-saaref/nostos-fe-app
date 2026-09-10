import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/test-utils'
import { IncomePlate } from '@/modules/financial/components/IncomePlate'
import type { Income } from '@/types/income'

const income: Income = {
  id: 'inc-1',
  name: 'Gaji bulan ini',
  amount: 8600000,
  typeId: 'itype-0',
  fromSourceId: null,
  toSourceId: 'source-bni',
  date: '2026-09-01',
  householdId: 'h1',
  createdByUserId: 'user-1',
}

const props = {
  income,
  rim: 1 as const,
  fromName: null,
  toName: 'BNI',
  recorderName: 'Sari',
  isOpen: false,
  onToggle: () => {},
  currency: 'IDR',
  canManage: false,
}

describe('IncomePlate', () => {
  // The row renders a word, never the uuid behind it.
  it('renders the resolved type name', () => {
    renderWithProviders(<IncomePlate {...props} typeName="gaji" />)

    expect(screen.getByText(/gaji/)).toBeInTheDocument()
    expect(screen.queryByText(/itype-0/)).not.toBeInTheDocument()
  })

  // An unresolvable id is an em dash: a uuid on screen is worse than an
  // admission that the word is gone.
  it('renders an em dash when the type cannot be resolved', () => {
    renderWithProviders(<IncomePlate {...props} typeName="—" />)

    expect(screen.queryByText(/itype-0/)).not.toBeInTheDocument()
    expect(screen.getByText(/—/)).toBeInTheDocument()
  })
})
