import type { ReactElement, ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HouseholdContext } from '@/contexts/HouseholdContext'
import type { HouseholdContextValue } from '@/contexts/HouseholdContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { MOCK_HOUSEHOLD, MOCK_USER } from '@/mocks/fixtures/household'

export const createTestQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })

/** Wrapper for renderHook — QueryClient + Router, no household context. */
export const createWrapper = () => {
  const client = createTestQueryClient()
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <SettingsProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </SettingsProvider>
    </QueryClientProvider>
  )
}

export const TEST_HOUSEHOLD_VALUE: HouseholdContextValue = {
  user: MOCK_USER,
  household: MOCK_HOUSEHOLD,
  householdId: MOCK_HOUSEHOLD.id,
  role: 'admin',
  isAuthenticated: true,
  isLoading: false,
}

interface RenderOptions {
  household?: Partial<HouseholdContextValue>
  initialEntries?: string[]
}

/** Render a component with QueryClient + Router + a fixed household context. */
export const renderWithProviders = (
  ui: ReactElement,
  options: RenderOptions = {},
) => {
  const client = createTestQueryClient()
  const householdValue: HouseholdContextValue = {
    ...TEST_HOUSEHOLD_VALUE,
    ...options.household,
  }
  return render(
    <QueryClientProvider client={client}>
      <SettingsProvider>
        <MemoryRouter initialEntries={options.initialEntries ?? ['/']}>
          <HouseholdContext.Provider value={householdValue}>
            {ui}
          </HouseholdContext.Provider>
        </MemoryRouter>
      </SettingsProvider>
    </QueryClientProvider>,
  )
}

/**
 * Drive a designed Select the way a person does: open it, then pick. Radix
 * renders its listbox only while open, so there is no option to query until
 * the trigger has been activated.
 */
export const chooseOption = async (
  triggerName: RegExp | string,
  optionName: RegExp | string,
) => {
  await userEvent.click(screen.getByRole('combobox', { name: triggerName }))
  const listbox = await screen.findByRole('listbox')
  await userEvent.click(
    within(listbox).getByRole('option', { name: optionName }),
  )
}
