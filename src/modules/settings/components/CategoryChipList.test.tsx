import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoryChipList } from '@/modules/settings/components/CategoryChipList'

const base = {
  id: 'category-1',
  name: 'Belanja',
  systemKey: 'SHOPPING' as const,
  archivedAt: null,
}

const props = {
  domain: 'expense' as const,
  canManage: true,
  nameLabel: 'Nama kategori',
  archivedLabel: 'Diarsipkan',
  saveLabel: 'Simpan',
  archiveLabel: 'Arsipkan',
  restoreLabel: 'Pulihkan',
  onRename: vi.fn(),
  onArchive: vi.fn(),
  onRestore: vi.fn(),
}

describe('CategoryChipList', () => {
  it('keeps its semantic icon when the mutable name changes', () => {
    const { container, rerender } = render(
      <CategoryChipList {...props} items={[base]} />,
    )
    const before = container.querySelector('[data-category-icon]')
      ?.getAttribute('data-category-icon')

    rerender(
      <CategoryChipList
        {...props}
        items={[{ ...base, name: 'Belanja bulanan keluarga besar' }]}
      />,
    )

    expect(container.querySelector('[data-category-icon]'))
      .toHaveAttribute('data-category-icon', before)
    expect(screen.getByText('Belanja bulanan keluarga besar'))
      .toHaveClass('break-words')
  })

  it('makes archived state explicit and offers restore instead of archive', async () => {
    render(
      <CategoryChipList
        {...props}
        items={[{ ...base, archivedAt: '2026-10-01' }]}
      />,
    )

    expect(screen.getByText('Diarsipkan')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /belanja/i }))
    expect(screen.getByRole('button', { name: 'Pulihkan' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Arsipkan' })).toBeNull()
  })

  it('opens and closes chip actions from the keyboard', async () => {
    render(<CategoryChipList {...props} items={[base]} />)

    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByLabelText('Nama kategori')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByLabelText('Nama kategori')).toBeNull()
  })
})
