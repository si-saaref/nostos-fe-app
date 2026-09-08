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

### Running against the real backend

The app talks to `${VITE_API_URL}/api/v1` and authenticates with the
`household.sid` session cookie.

`VITE_ENABLE_MOCKS` is the only mock-related environment variable, and it is a
kill switch: `false` turns the MSW worker off entirely.

**Which modules are mocked is declared in code**, in the `MOCKED` map at the
top of `src/mocks/handlers/index.ts`:

```ts
export const MOCKED: MockedDomains = {
  auth: false, // shipped
  expense: false, // shipped
  prefs: true, // route not built — the live API answers 404
}
```

A module goes live in the same diff that integrates it, which is where that
decision belongs: it is a fact about the commit, not about the machine running
it. Flip an entry to `true` locally to work offline or against an unfinished
endpoint — just do not commit it. Adding a module means one row here and one in
`DOMAIN_PATHS` below it, not another environment variable.

Start the backend (the Postman collection defaults to `http://localhost:3073`;
point `VITE_API_URL` at whichever port yours serves), then `npm run dev`. The
console prints the state of every domain on startup. If the browser drops the
session cookie across origins, uncomment the `/api` proxy in `vite.config.ts`
to make the requests same-origin.

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
