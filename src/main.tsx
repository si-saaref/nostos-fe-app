import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import '@/styles/globals.css'
import { readStoredTheme } from '@/theme/themes'
import { getLocale } from '@/paraglide/runtime.js'

// Applied before React mounts so the document never paints in the wrong theme.
document.documentElement.dataset.theme = readStoredTheme()
document.documentElement.lang = getLocale()

async function enableMocking() {
  if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS === 'false') {
    // Said out loud because the failure mode is silent: with mocks off, every
    // unshipped endpoint goes to the real API and answers 404, which looks
    // like a broken backend rather than a missing mock layer.
    console.info(
      '[msw] mocking disabled — every request goes to',
      import.meta.env.VITE_API_URL || 'the app origin',
    )
    return
  }
  // Dynamic: a static import would bundle the mocks into production.
  const { worker } = await import('@/mocks/browser')
  const { MOCKED, isLiveApiPath } = await import('@/mocks/handlers')
  await worker.start({
    onUnhandledRequest(request, print) {
      const { pathname } = new URL(request.url)
      // Assets, HMR, fonts — never our concern.
      if (!pathname.includes('/api/')) return
      // A domain we deliberately let reach the real backend.
      if (isLiveApiPath(pathname)) return
      // Anything else is an endpoint nobody mocked, or a handler path that
      // stopped matching. Both are invisible 404s under 'bypass'.
      print.warning()
    },
  })
  // Read from the declaration, so it cannot disagree with it.
  console.info(
    '[msw] worker started. Mocked:',
    Object.entries(MOCKED)
      .map(([domain, mocked]) => `${domain} ${mocked ? 'mocked' : 'live'}`)
      .join(', '),
  )
}

enableMocking()
  .catch((error) => {
    console.error('[msw] failed to start mock worker', error)
  })
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
