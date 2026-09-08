import { setupServer } from 'msw/node'
import { testHandlers } from '@/mocks/handlers'

/** Fully mocked, never a network. `testHandlers` so `MOCKED` cannot empty it. */
export const server = setupServer(...testHandlers)
