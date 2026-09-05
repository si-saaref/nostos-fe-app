# Household App — Frontend

Tenant-aware React app for managing a household's finances — the family-facing
NOSTOS app (the Operator Console is a separate repo).

**[`docs/FRONTEND.md`](docs/FRONTEND.md) is the authoritative technical record**
for this repo: what is built, how it is wired, where it currently disagrees with
its specs, and what is open. Read this file to get running; read that one to
understand the code.

Product and architecture truth lives in the Nostos vault, symlinked at `notes/`.

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

See [`docs/FRONTEND.md`](docs/FRONTEND.md) §6.

## Engineering reports

| Document                                                       | What it covers                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [`docs/CODE-REVIEW-FINDINGS.md`](docs/CODE-REVIEW-FINDINGS.md) | Full review of the codebase, by severity, with what is fixed and what is open    |
| [`docs/REFACTOR-2026-08-31.md`](docs/REFACTOR-2026-08-31.md)   | What the `refactor/code` branch changed and why                                  |
| [`docs/API-GAP-ANALYSIS.md`](docs/API-GAP-ANALYSIS.md)         | Where the frontend and the shipped API disagree, and what the backend still owes |

**Read the gap analysis before starting integration work** — the frontend was built against
its own MSW mock, and 3 of its 18 endpoint calls currently exist on the server.

## Security notes

`npm audit` in CI is **informational**, and one advisory
(`react-router-dom` GHSA-qwww-vcr4-c8h2) is knowingly accepted. The rationale is
in [`docs/FRONTEND.md`](docs/FRONTEND.md) §13.
