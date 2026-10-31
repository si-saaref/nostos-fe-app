import { useRef } from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { useNotifications } from './useNotifications'
import { renderWithProviders } from '@/test/test-utils'

const Trigger = ({ duration = 5000 }: { duration?: number }) => {
  const { notify } = useNotifications()
  const navigate = useNavigate()
  const count = useRef(0)
  return (
    <>
      <button
        onClick={() => notify({ title: `Saved ${++count.current}`, duration })}
      >
        Notify
      </button>
      <button
        onClick={() => {
          notify({ title: 'Saved before leaving' })
          navigate('/next')
        }}
      >
        Save and leave
      </button>
    </>
  )
}

it('keeps feedback visible after its source page unmounts and supports dismissal', async () => {
  renderWithProviders(
    <Routes>
      <Route path="/" element={<Trigger />} />
      <Route path="/next" element={<h1>Next page</h1>} />
    </Routes>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save and leave' }))
  expect(screen.getByRole('heading', { name: 'Next page' })).toBeInTheDocument()
  expect(
    screen.getByRole('status', { name: 'Saved before leaving' }),
  ).toBeInTheDocument()
  await userEvent.click(
    screen.getByRole('button', { name: 'Tutup notifikasi' }),
  )
  expect(
    screen.queryByRole('status', { name: 'Saved before leaving' }),
  ).toBeNull()
})

it('bounds the visible stack to the three most recent messages', async () => {
  renderWithProviders(<Trigger />)
  expect(screen.queryByRole('list')).toBeNull()
  const trigger = screen.getByRole('button', { name: 'Notify' })
  for (let index = 0; index < 5; index++) await userEvent.click(trigger)
  expect(screen.queryByRole('status', { name: 'Saved 1' })).toBeNull()
  expect(screen.queryByRole('status', { name: 'Saved 2' })).toBeNull()
  for (const number of [3, 4, 5])
    expect(
      screen.getByRole('status', { name: `Saved ${number}` }),
    ).toBeInTheDocument()
})

it('automatically dismisses transient feedback', async () => {
  renderWithProviders(<Trigger duration={150} />)
  await userEvent.click(screen.getByRole('button', { name: 'Notify' }))
  expect(screen.getByRole('status', { name: 'Saved 1' })).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.queryByRole('status', { name: 'Saved 1' })).toBeNull(),
  )
})

it('pauses dismissal while the notification is hovered', async () => {
  renderWithProviders(<Trigger duration={150} />)
  await userEvent.click(screen.getByRole('button', { name: 'Notify' }))
  const notification = screen.getByRole('status', { name: 'Saved 1' })
  await userEvent.hover(notification)
  await new Promise((resolve) => setTimeout(resolve, 200))
  expect(notification).toBeInTheDocument()
  await userEvent.unhover(notification)
  await waitFor(() =>
    expect(screen.queryByRole('status', { name: 'Saved 1' })).toBeNull(),
  )
})
