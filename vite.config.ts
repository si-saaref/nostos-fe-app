/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { fileURLToPath, URL } from 'node:url'

// import { paraglideConfig } from './paraglide.config.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())

  return {
    plugins: [
      react(),
      tailwindcss(),
      paraglideVitePlugin({
        project: './project.inlang',
        outdir: './src/paraglide',
        // The app is a client-only SPA with an explicit language control, so the
        // locale is remembered per device rather than carried in the URL.
        strategy: ['localStorage', 'preferredLanguage', 'baseLocale'],
        emitTsDeclarations: true,
      }),
    ],
    base: env.VITE_BASE_PATH || '/',
    server: {
      port: 6060,
      // proxy: {
      //   '/api': {
      //     target: env.VITE_API_URL || 'http://localhost:8080',
      //     changeOrigin: true,
      //     secure: false,
      //   },
      // },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
      // These are jsdom + MSW integration tests, not unit tests: a render, a
      // round trip through the mock server, and a user-event interaction. Under
      // parallel file execution the default 5s is tight enough that whichever
      // file loses the CPU race times out, which reads as a flaky suite rather
      // than the machine contention it is.
      testTimeout: 15_000,
    },
  }
})
