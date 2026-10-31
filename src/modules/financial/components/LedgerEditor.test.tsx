import { useState } from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { LedgerEditor } from './LedgerEditor'

const Capture = () => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Record</button>
      <LedgerEditor open={open} title="Capture" onClose={() => setOpen(false)}>
        <form>
          <label>
            Description
            <textarea />
          </label>
          {Array.from({ length: 25 }, (_, i) => (
            <p key={i}>Field {i}</p>
          ))}
          <button type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button>Save</button>
        </form>
      </LedgerEditor>
    </>
  )
}

it('keeps an edited long form on Escape and restores focus after explicit cancel', async () => {
  renderWithProviders(<Capture />)
  await userEvent.click(screen.getByRole('button', { name: 'Record' }))
  const dialog = screen.getByRole('dialog', { name: 'Capture' })
  await userEvent.type(screen.getByRole('textbox'), 'A long draft')
  await userEvent.keyboard('{Escape}')
  expect(dialog).toBeInTheDocument()
  expect(screen.getByRole('textbox')).toHaveValue('A long draft')
  expect(screen.getByText('Field 24')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(screen.getByRole('button', { name: 'Record' })).toHaveFocus()
})

it('bounds the editor to the visual viewport as the phone keyboard changes it', async () => {
  const original = window.visualViewport
  const viewport = Object.assign(new EventTarget(), {
    height: 600,
    offsetTop: 0,
  })
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  })
  try {
    renderWithProviders(<Capture />)
    await userEvent.click(screen.getByRole('button', { name: 'Record' }))
    const { act } = await import('@testing-library/react')
    viewport.height = 300
    act(() => {
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(screen.getByRole('dialog').style.maxHeight).toContain('300px')
  } finally {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: original,
    })
  }
})
