import { overwriteGetLocale } from '@/paraglide/runtime.js'

// jsdom reports navigator.language as en-US, so Paraglide's preferredLanguage
// strategy would resolve English here. That is correct in a real browser and
// useless in a test: pin the locale so assertions have one language to target.
overwriteGetLocale(() => 'id')

import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '@/mocks/server'
import { resetMockState } from '@/mocks/data'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockState()
})
afterAll(() => server.close())
