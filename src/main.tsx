import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import '@/styles/globals.css'
import { readStoredTheme } from '@/theme/themes'
import { readStoredLang } from '@/i18n/strings'

// Applied before React mounts so the document never paints in the wrong theme.
document.documentElement.dataset.theme = readStoredTheme()
document.documentElement.lang = readStoredLang()

async function enableMocking() {
  if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS === 'false') {
    return
  }
  const { worker } = await import('@/mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
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
