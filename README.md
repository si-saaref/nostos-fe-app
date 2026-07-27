# Household App — Frontend

Tenant-aware React app for managing a household's finances. Built per
`FE-Architecture-REVISED.md`.

## Stack

React 19 · Vite 8 · TypeScript (strict) · React Router 7 · TanStack Query 5 ·
React Hook Form · Tailwind v4 · Vitest + Testing Library + MSW · Capacitor.

## State ownership

- **Server state** → TanStack Query (tenant-scoped query keys)
- **Filters** → URL params (`useSearchParams`)
- **Session** → `HouseholdContext`
- **Local UI** → `useState`

No Zustand, no global store.

## Getting started

```bash
npm install
npm run dev        # runs with the MSW mock backend (VITE_ENABLE_MOCKS=true)
```

Copy `.env.example` to `.env.local` and set `VITE_API_URL` to point at a real
backend; set `VITE_ENABLE_MOCKS=false` to disable mocks.

## Scripts

| Script                  | Purpose                       |
| ----------------------- | ----------------------------- |
| `npm run dev`           | Dev server (MSW mocks in dev) |
| `npm run build`         | Type-check + production build |
| `npm run test`          | Run Vitest suite              |
| `npm run test:watch`    | Vitest watch mode             |
| `npm run test:coverage` | Coverage report               |
| `npm run lint`          | ESLint                        |
| `npm run type-check`    | `tsc` no-emit                 |
| `npm run format`        | Prettier write                |

## Mobile (Capacitor)

Config lives in `capacitor.config.ts` (`webDir: dist`). Generating native
projects needs local toolchains (Xcode + CocoaPods for iOS, Android Studio +
SDK for Android):

```bash
npm run build
npx cap add ios        # or: npx cap add android
npm run cap:sync
npm run cap:ios        # opens Xcode
```

## Project structure

See `docs/superpowers/specs/2026-07-26-household-fe-init-design.md` §5.

## Security notes

`npm audit` in CI (`.github/workflows/security.yml`) is **informational**
(`continue-on-error: true`) — it reports advisories in the logs but does not
fail the build.

**Accepted advisory:** `react-router-dom@7.18.1` — GHSA-qwww-vcr4-c8h2 (HIGH,
"RSC-mode CSRF bypass"). This project is a **client-only SPA** and does not use
React Router's React Server Components mode, so the advisory does not apply. The
dependency is exact-pinned; revisit and bump if/when a patched release is
available.
