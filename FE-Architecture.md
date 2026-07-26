# Frontend Architecture - Household App (Web + Mobile via Capacitor.js)

## Table of Contents

1. [Background](#1-background)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Project Structure](#3-project-structure)
4. [Data Fetching Strategy](#4-data-fetching-strategy)
5. [State Management](#5-state-management)
6. [Authentication & Session](#6-authentication--session)
7. [Multi-Tenant Isolation](#7-multi-tenant-isolation)
8. [Testing Strategy](#8-testing-strategy)
9. [Performance & Optimization](#9-performance--optimization)
10. [CI/CD & Deployment](#10-cicd--deployment)
11. [Security](#11-security)
12. [Mobile Strategy (Capacitor.js)](#12-mobile-strategy-capacitorjs)
13. [Module Structure](#13-module-structure)

---

## 1. Background

### Former Approach

Early household app attempts struggled with:

- ❌ Unclear tenant scoping in components
- ❌ Permission checks scattered across code
- ❌ No consistent data fetching pattern
- ❌ Difficult to test multi-tenant scenarios
- ❌ Web-only; no mobile strategy

### Why This Architecture

**This design prioritizes:**

- ✅ **Tenant-Aware Components** — Every component knows its household_id
- ✅ **Permission-First UI** — Role checks at component & hook level
- ✅ **Server State Focus** — TanStack Query for API data, minimal local state
- ✅ **Testability** — Mock household context, test in isolation
- ✅ **Web + Mobile** — React web + Capacitor.js for iOS/Android
- ✅ **DX** — Fast feedback (Vite + Vitest), clear conventions

---

## 2. High-Level Architecture

### 2.1 Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                    HOUSEHOLD APP (Frontend)                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           Pages / Routes                                │   │
│  │  (Auth, Dashboard, Financial, Tasks, Notes, etc.)       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           HouseholdContext (Session)                    │   │
│  │  ├─ user_id                                             │   │
│  │  ├─ household_id  ← KEY: tenant scoping               │   │
│  │  ├─ role (admin/member)                                │   │
│  │  └─ permissions[]                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            ↓                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Modules     │  │  Hooks       │  │  Components  │          │
│  │              │  │              │  │              │          │
│  │ financial/   │  │ useExpense   │  │ ExpenseForm  │          │
│  │ tasks/       │  │ useUser      │  │ ExpenseList  │          │
│  │ notes/       │  │ useAuth      │  │ Dashboard    │          │
│  │ meal-plan/   │  │              │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         ↓                  ↓                  ↓                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           TanStack Query (React Query)                  │   │
│  │  ├─ queries: GET /api/expenses, GET /api/users, etc.   │   │
│  │  ├─ mutations: POST/PUT/DELETE with household_id      │   │
│  │  └─ caching + retry + background refetch               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           API Client (Axios + Interceptors)             │   │
│  │  ├─ Authorization header (session cookie)               │   │
│  │  ├─ household_id in request headers                     │   │
│  │  └─ Error handling (401 → logout, 403 → permission)    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           Backend API (NestJS + Supabase)               │   │
│  │  ├─ Validates household_id from header                  │   │
│  │  ├─ Enforces role-based access                          │   │
│  │  ├─ Returns only scoped data (WHERE household_id = X)   │   │
│  │  └─ PostgreSQL + RLS (row-level security)               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

BROWSER                                  BACKEND
(React + Vite)                          (NestJS + Postgres)
   ↕                                         ↕
 HTTP/S                                   REST API
```

---

## 2.2 Core Technology Stack

| Layer             | Technology                     | Reason                                                |
| ----------------- | ------------------------------ | ----------------------------------------------------- |
| **Framework**     | React 18 + TypeScript          | Component-driven, strict type safety                  |
| **Build Tool**    | Vite                           | Fast dev server, instant HMR, modern bundling         |
| **Routing**       | React Router v7                | Declarative, code splitting, nested routes            |
| **Server State**  | TanStack Query (React Query)   | Caching, background refetch, deduplication, retry     |
| **Client State**  | Zustand + Context API          | Lightweight, predictable, minimal boilerplate         |
| **HTTP Client**   | Axios                          | Interceptors for auth, tenant scoping, error handling |
| **Forms**         | React Hook Form                | Performant, minimal re-renders, easy validation       |
| **Styling**       | Tailwind CSS                   | Utility-first, consistent design system               |
| **UI Components** | Headless UI / Radix UI         | Unstyled, accessible, composable                      |
| **Testing**       | Vitest + Testing Library + MSW | Fast, Jest-compatible, API mocking                    |
| **Mobile**        | Capacitor.js                   | Wrap React web app → iOS/Android native               |
| **Linting**       | ESLint (Flat Config)           | Unified code quality                                  |
| **Formatting**    | Prettier                       | Code consistency                                      |
| **Git Hooks**     | Husky + lint-staged            | Pre-commit checks                                     |

---

## 3. Project Structure

### 3.1 Folder Structure

```
household-app-web/
├── public/
│   ├── icons/                    # App icons (PWA, favicon)
│   └── locales/                  # i18n files (future)
│
├── src/
│   ├── __mocks__/                # Mock data for tests
│   │   ├── expenses.mock.ts
│   │   ├── users.mock.ts
│   │   └── household.mock.ts
│   │
│   ├── __tests__/                # Test files (co-located or centralized)
│   │   ├── hooks/
│   │   ├── components/
│   │   └── api/
│   │
│   ├── api/                       # TanStack Query service layer
│   │   ├── queries/               # GET requests
│   │   │   ├── useExpenses.ts
│   │   │   ├── useUsers.ts
│   │   │   └── useAuth.ts
│   │   ├── mutations/             # POST/PUT/DELETE requests
│   │   │   ├── useCreateExpense.ts
│   │   │   ├── useUpdateExpense.ts
│   │   │   └── useDeleteExpense.ts
│   │   ├── client.ts              # Axios instance + interceptors
│   │   └── types.ts               # API response types
│   │
│   ├── components/                # Shared UI components
│   │   ├── ExpenseForm.tsx        # Form for create/edit
│   │   ├── ExpenseList.tsx        # Table/list view
│   │   ├── DeleteConfirm.tsx      # Modal for delete
│   │   ├── PermissionGuard.tsx    # Permission wrapper
│   │   └── Loading.tsx            # Loading states
│   │
│   ├── contexts/                  # React Context (mostly auth/session)
│   │   ├── HouseholdContext.tsx   # KEY: Provides household_id, user, role
│   │   ├── useHousehold.ts        # Hook to access context
│   │   └── AuthContext.tsx        # Auth state (login, logout, signup)
│   │
│   ├── hooks/                     # Custom hooks (reusable logic)
│   │   ├── useExpense.ts          # Business logic for expenses
│   │   ├── usePermission.ts       # Check if user can edit/delete
│   │   ├── useAsync.ts            # Generic async wrapper
│   │   └── useLocalStorage.ts     # Persistent local state
│   │
│   ├── lib/                       # Library overrides, utilities
│   │   ├── queryClient.ts         # TanStack Query config
│   │   ├── axios.ts               # Axios setup (deprecated, moved to api/client.ts)
│   │   └── validation.ts          # Form validation schemas
│   │
│   ├── modules/                   # Feature modules (by domain)
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── SignupForm.tsx
│   │   │   │   └── PasswordReset.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useAuth.ts
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   └── SignupPage.tsx
│   │   │   ├── stores/
│   │   │   │   └── authStore.ts
│   │   │   └── types/
│   │   │       └── auth.ts
│   │   │
│   │   ├── financial/             # Expenditure, Income, Savings, etc.
│   │   │   ├── components/
│   │   │   │   ├── ExpenseForm.tsx
│   │   │   │   ├── ExpenseList.tsx
│   │   │   │   └── IncomeForm.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useExpenses.ts
│   │   │   │   ├── useIncome.ts
│   │   │   │   └── useFinancialFilters.ts
│   │   │   ├── pages/
│   │   │   │   ├── FinancialDashboard.tsx
│   │   │   │   ├── ExpensesPage.tsx
│   │   │   │   └── IncomePage.tsx
│   │   │   ├── stores/
│   │   │   │   ├── expenseStore.ts
│   │   │   │   └── filterStore.ts
│   │   │   └── types/
│   │   │       ├── expense.ts
│   │   │       └── income.ts
│   │   │
│   │   ├── tasks/                 # Task management
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── pages/
│   │   │   └── types/
│   │   │
│   │   ├── household-settings/    # Family management, invite, types/sources config
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── pages/
│   │   │   └── types/
│   │   │
│   │   └── [more modules]/
│   │
│   ├── pages/                     # Page components (match routes)
│   │   ├── AuthLayout.tsx
│   │   ├── DashboardLayout.tsx
│   │   ├── ErrorPage.tsx
│   │   └── NotFoundPage.tsx
│   │
│   ├── routes/                    # Route definitions
│   │   ├── index.tsx              # Route config
│   │   ├── ProtectedRoute.tsx     # Auth guard
│   │   └── PermissionRoute.tsx    # Role guard
│   │
│   ├── stores/                    # Global state (Zustand)
│   │   ├── notificationStore.ts   # Toast/notifications
│   │   └── uiStore.ts            # UI state (sidebar, theme, etc.)
│   │
│   ├── styles/                    # Global styles
│   │   ├── globals.css
│   │   ├── variables.css
│   │   └── animations.css
│   │
│   ├── types/                     # Shared TypeScript types
│   │   ├── index.ts
│   │   ├── household.ts           # Household, User, Permissions
│   │   ├── expense.ts             # Expense, Type, Source
│   │   └── api.ts                 # API errors, responses
│   │
│   ├── utils/                     # Helper functions
│   │   ├── formatters.ts          # Format currency, date, etc.
│   │   ├── validators.ts          # Validation helpers
│   │   ├── permissions.ts         # Permission checking
│   │   ├── errors.ts              # Error handling
│   │   └── localStorage.ts        # Local storage helpers
│   │
│   ├── App.tsx                    # Root component
│   └── main.tsx                   # Entry point
│
├── capacitor.config.ts            # Capacitor config (iOS/Android)
├── vite.config.ts                 # Vite config
├── vitest.config.ts               # Vitest config
├── tsconfig.json                  # TypeScript config
├── tailwind.config.js             # Tailwind config
├── eslintrc.config.js             # ESLint config (Flat)
├── prettier.config.js             # Prettier config
└── package.json
```

---

## 3.2 Naming Conventions

### File Names

**React Components:** PascalCase, one per file

```
components/ExpenseForm.tsx
components/DeleteConfirmModal.tsx
modules/financial/components/ExpenseTable.tsx
```

**Hooks:** camelCase, starts with `use`

```
hooks/useExpense.ts
hooks/usePermission.ts
modules/financial/hooks/useExpenses.ts
api/queries/useExpenses.ts
```

**Utils/Helpers:** camelCase, named by responsibility

```
utils/formatCurrency.ts
utils/validateForm.ts
utils/errorHandler.ts
api/client.ts
```

**Types/Interfaces:** PascalCase, suffix with `Type` or `Props`

```
types/ExpenseType.ts
types/ExpenseFormPropsType.ts
types/ApiErrorType.ts
```

**Stores (Zustand):** camelCase, ends with `Store`

```
stores/notificationStore.ts
stores/uiStore.ts
modules/financial/stores/expenseStore.ts
```

**Directories:** kebab-case

```
modules/household-settings/
components/permission-guard/
api/queries/
```

### Boolean Naming

Prefix with `is`, `has`, `can`, or `should`:

```
isAdmin
hasPermission
canEdit
canDelete
shouldFetch
isLoading
```

---

## 4. Data Fetching Strategy

### 4.1 TanStack Query (React Query)

**Why NOT Redux/RTK Query:**

- This app is **API-heavy**, not global-state-heavy
- TanStack Query excels at:
  - Server state management
  - Automatic caching & deduplication
  - Background refetch
  - Retry logic
  - Optimistic updates
  - Request deduplication (same query called twice = one HTTP call)

**Data Flow:**

```
Component A                Component B
  ↓                              ↓
  useExpenses()            useExpenses()
    ↓                            ↓
┌───────────────────────────────────────┐
│    TanStack Query Cache               │
│  (query key: ['expenses', '001'])    │ ← household_id is part of key
│  Returns cached data, prevents dups   │
└───────────────────────────────────────┘
  ↓
  API Client (Axios) → /api/expenses?household_id=001
    ↓
  Backend (NestJS)
  ↓
  Database (Postgres)
```

### 4.2 Query Key Design

**Pattern:** `[domain, resource, filters]`

```typescript
// Queries
const EXPENSE_KEYS = {
  all: ['expenses'] as const,
  lists: () => [...EXPENSE_KEYS.all, 'list'] as const,
  list: (householdId: string, filters?: FilterType) =>
    [...EXPENSE_KEYS.lists(), { householdId, ...filters }] as const,
  details: () => [...EXPENSE_KEYS.all, 'detail'] as const,
  detail: (id: string, householdId: string) =>
    [...EXPENSE_KEYS.details(), id, householdId] as const,
}

// Usage
useQuery({
  queryKey: EXPENSE_KEYS.list(householdId, filters),
  queryFn: () => getExpenses(householdId, filters),
})

// TanStack automatically:
// - Caches by query key
// - Deduplicates identical keys
// - Invalidates on mutations
```

### 4.3 Household ID in Queries

**Every query must include `householdId`:**

```typescript
// ✅ CORRECT: householdId in query key + params
useQuery({
  queryKey: ['expenses', householdId, filters],
  queryFn: () => apiClient.get('/expenses', { params: { ...filters } }),
  // Note: householdId sent in header by axios interceptor
})

// ❌ WRONG: Missing householdId
useQuery({
  queryKey: ['expenses', filters], // No tenant scoping!
  queryFn: () => apiClient.get('/expenses'),
})
```

### 4.4 Mutations with Optimistic Updates

```typescript
// Create expense (optimistic update)
const { mutate: createExpense } = useMutation({
  mutationFn: (data: CreateExpenseDTO) => apiClient.post('/expenses', data),
  onMutate: async (newExpense) => {
    // Cancel in-flight queries
    await queryClient.cancelQueries({ queryKey: ['expenses', householdId] })

    // Snapshot previous state
    const previous = queryClient.getQueryData(['expenses', householdId])

    // Optimistically update cache
    queryClient.setQueryData(
      ['expenses', householdId],
      (old: ExpenseType[]) => [newExpense, ...old],
    )

    return { previous }
  },
  onSuccess: () => {
    // Refetch to sync with server
    queryClient.invalidateQueries({ queryKey: ['expenses', householdId] })
  },
  onError: (error, _, context) => {
    // Rollback on error
    queryClient.setQueryData(['expenses', householdId], context?.previous)
  },
})
```

---

## 5. State Management

### 5.1 Context for Session/Auth

**HouseholdContext** — Shared session across entire app:

```typescript
// src/contexts/HouseholdContext.tsx
interface HouseholdContextType {
  user: UserType | null;
  household: HouseholdType | null;
  householdId: string;
  role: 'admin' | 'member';
  permissions: PermissionType[];
  isLoading: boolean;
  logout: () => void;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export const HouseholdProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: session, isLoading } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: () => apiClient.get('/auth/session'),
  });

  return (
    <HouseholdContext.Provider value={{ /* ... */ }}>
      {children}
    </HouseholdContext.Provider>
  );
};

// Usage in components
const useHousehold = () => {
  const context = useContext(HouseholdContext);
  if (!context) throw new Error('useHousehold must be within HouseholdProvider');
  return context;
};

// In any component
export const ExpenseForm = () => {
  const { householdId, role } = useHousehold();  // ← Access tenant context
  return <form>{/* ... */}</form>;
};
```

### 5.2 Zustand for UI/Global State

**NotificationStore** — Toast notifications:

```typescript
// src/stores/notificationStore.ts
type NotificationType = 'success' | 'error' | 'warning' | 'info'

interface NotificationStoreType {
  notifications: { id: string; message: string; type: NotificationType }[]
  add: (message: string, type: NotificationType) => void
  remove: (id: string) => void
}

export const useNotificationStore = create<NotificationStoreType>((set) => ({
  notifications: [],
  add: (message, type) => {
    const id = Date.now().toString()
    set((state) => ({
      notifications: [...state.notifications, { id, message, type }],
    }))
    // Auto-remove after 3s
    setTimeout(
      () =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),
      3000,
    )
  },
  remove: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}))

// Usage
const { add } = useNotificationStore()
add('Expense created!', 'success')
```

### 5.3 State Architecture

```
HouseholdContext (Auth + Session)
  ├─ user_id
  ├─ household_id  ← Injected into all queries
  ├─ role
  └─ permissions

TanStack Query (Server State)
  ├─ /api/expenses?household_id=001
  ├─ /api/users?household_id=001
  └─ Caching, retry, refetch

Zustand Stores (UI State)
  ├─ Notifications
  ├─ UI (sidebar, theme)
  └─ Filters (client-side only)

Component State (useState)
  └─ Form values, temporary UI state
```

---

## 6. Authentication & Session

### 6.1 Auth Flow

```
1. User visits app
   ↓
2. Check if session cookie exists
   ├─ YES → Fetch /auth/session → Hydrate HouseholdContext
   ├─ NO → Redirect to /auth/login
   ↓
3. User fills login form
   ↓
4. POST /auth/login (email + password)
   ↓
5. Backend validates, sets HttpOnly cookie
   ↓
6. Redirect to /dashboard
   ↓
7. HouseholdContext fetches session → renders app
   ↓
8. All API calls include cookie (automatic)
```

### 6.2 Axios Interceptors

**Add `household_id` header to all requests:**

```typescript
// src/api/client.ts
import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true, // ← Send cookies
})

// Interceptor: Add household_id from context
apiClient.interceptors.request.use((config) => {
  const { householdId } = useHousehold?.() // ← Access context
  if (householdId) {
    config.headers['X-Household-ID'] = householdId
  }
  return config
})

// Interceptor: Handle 401 (logout) & 403 (permission)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Logout
      window.location.href = '/auth/login'
    } else if (error.response?.status === 403) {
      // Permission denied
      useNotificationStore
        .getState()
        .add('You do not have permission to perform this action', 'error')
    }
    return Promise.reject(error)
  },
)
```

---

## 7. Multi-Tenant Isolation

### 7.1 Tenant Scoping Rules

**In every component/hook:**

```typescript
// ✅ CORRECT: Check tenant context, use householdId in queries
export const ExpenseList = () => {
  const { householdId } = useHousehold();

  const { data: expenses } = useQuery({
    queryKey: ['expenses', householdId],  // ← Tenant-scoped key
    queryFn: () => getExpenses(householdId),
  });

  return <div>{/* Only this household's expenses */}</div>;
};

// ❌ WRONG: No tenant scoping
export const ExpenseList = () => {
  const { data: expenses } = useQuery({
    queryKey: ['expenses'],  // Missing householdId!
    queryFn: () => getExpenses(),
  });

  return <div>{/* Could show ANY household's expenses! */}</div>;
};
```

### 7.2 Route Protection

**ProtectedRoute — Auth guard:**

```typescript
// src/routes/ProtectedRoute.tsx
export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, isLoading } = useHousehold();

  if (isLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/auth/login" />;

  return children;
};
```

**PermissionRoute — Role guard:**

```typescript
export const PermissionRoute = ({
  children,
  requiredRole
}: {
  children: ReactNode;
  requiredRole: 'admin' | 'member';
}) => {
  const { role } = useHousehold();

  if (role !== requiredRole) {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

// Usage
<PermissionRoute requiredRole="admin">
  <HouseholdSettingsPage />  {/* Only admins see this */}
</PermissionRoute>
```

---

## 8. Testing Strategy

### 8.1 Testing Stack

- **Runner:** Vitest (Jest-compatible, Vite-native)
- **UI Testing:** @testing-library/react
- **Hooks Testing:** @testing-library/react + renderHook
- **API Mocking:** MSW (Mock Service Worker)
- **Coverage:** Vitest built-in coverage

### 8.2 Testing Pyramid

```
              ▲
             ╱│╲
            ╱ │ ╲
           ╱  │  ╲  Integration Tests (2-5)
          ╱   │   ╲ (API + Component flow)
         ╱────┼────╲
        ╱     │     ╲
       ╱  Component  ╲
      ╱ Tests (10-20)╲
     ╱───────┼────────╲
    ╱       │         ╲
   ╱ Hook Tests (30-50)╲  ← Most tests here
  ╱─────────┼───────────╲   (Business logic)
 ╱         │           ╲
╱──────────────────────────╲
```

### 8.3 Mocking Strategy

**What NOT to mock:**

- ❌ React components under test
- ❌ Custom hooks (business logic)
- ❌ TanStack Query hooks
- ❌ Internal state transitions

**What TO mock:**

- ✅ API layer (via MSW)
- ✅ External libraries (charts, maps, etc.)
- ✅ Browser APIs (localStorage, IntersectionObserver)
- ✅ Heavy UI components (editors, maps)

### 8.4 Example Tests

**Hook Test: `useExpense`**

```typescript
// modules/financial/hooks/__tests__/useExpense.test.ts
import { renderHookWithProviders } from '@/__tests__/utils'
import { server } from '@/__tests__/mocks/server'
import { rest } from 'msw'
import { useExpense } from '../useExpense'

describe('useExpense', () => {
  it('should fetch expense by id within household', async () => {
    const { result, waitFor } = renderHookWithProviders(() =>
      useExpense({ id: '123', householdId: '001' }),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).toEqual({
      id: '123',
      name: 'Groceries',
      value: 150000,
    })
  })

  it('should return error if expense not found', async () => {
    server.use(
      rest.get('/api/expenses/:id', (_, res, ctx) =>
        res(ctx.status(404), ctx.json({ error: 'Not found' })),
      ),
    )

    const { result, waitFor } = renderHookWithProviders(() =>
      useExpense({ id: '999', householdId: '001' }),
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe('Not found')
  })
})
```

**Component Test: `ExpenseForm`**

```typescript
// modules/financial/components/__tests__/ExpenseForm.test.tsx
import { renderWithProviders } from '@/__tests__/utils';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { ExpenseForm } from '../ExpenseForm';

describe('ExpenseForm', () => {
  it('should render form with empty fields', () => {
    renderWithProviders(<ExpenseForm onSuccess={vi.fn()} />);

    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Value')).toHaveValue('');
  });

  it('should submit form and call onSuccess', async () => {
    const onSuccess = vi.fn();
    renderWithProviders(<ExpenseForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Groceries' },
    });
    fireEvent.change(screen.getByLabelText('Value'), {
      target: { value: '150000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it('should show error if member tries to submit', async () => {
    // Mock member role in HouseholdContext
    renderWithProviders(<ExpenseForm onSuccess={vi.fn()} />, {
      householdContextValue: { role: 'member' },
    });

    expect(screen.getByText(/only admin/i)).toBeInTheDocument();
  });
});
```

**MSW Setup:**

```typescript
// src/__tests__/mocks/handlers.ts
import { rest } from 'msw'

export const handlers = [
  rest.get('/api/expenses', (req, res, ctx) => {
    const householdId = req.headers.get('X-Household-ID')
    return res(
      ctx.json(mockExpenses.filter((e) => e.household_id === householdId)),
    )
  }),

  rest.post('/api/expenses', (req, res, ctx) => {
    return res(ctx.status(201), ctx.json({ id: '123', ...req.body }))
  }),

  rest.put('/api/expenses/:id', (req, res, ctx) => {
    return res(ctx.json({ id: req.params.id, ...req.body }))
  }),

  rest.delete('/api/expenses/:id', (req, res, ctx) => {
    return res(ctx.status(204))
  }),
]
```

---

## 9. Performance & Optimization

### 9.1 Code Splitting

```typescript
// src/routes/index.tsx
const FinancialModule = lazy(() => import('@/modules/financial'));
const TasksModule = lazy(() => import('@/modules/tasks'));

export const routes = [
  {
    path: '/financial',
    element: <Suspense fallback={<Loading />}><FinancialModule /></Suspense>,
  },
  {
    path: '/tasks',
    element: <Suspense fallback={<Loading />}><TasksModule /></Suspense>,
  },
];
```

### 9.2 Image Optimization

```typescript
// Use Vite's image import for optimization
import { heroImage } from '@/assets/images/hero.webp?url';

// Or use Cloudinary/Imgix for dynamic resizing
<img
  src={`https://images.imgix.net/image.jpg?w=500&h=300`}
  alt="Hero"
/>
```

### 9.3 TanStack Query Optimization

```typescript
// Stale time: Keep data fresh for 5 minutes
useQuery({
  queryKey: ['expenses', householdId],
  queryFn: getExpenses,
  staleTime: 5 * 60 * 1000, // 5 min
  gcTime: 10 * 60 * 1000, // Keep in cache 10 min after unused
  refetchOnWindowFocus: false, // Don't refetch on tab focus (if not needed)
})
```

### 9.4 Memoization

```typescript
// Only memoize if rerenders are expensive
export const ExpenseList = memo(({ expenses }: { expenses: ExpenseType[] }) => {
  return <div>{/* render */}</div>;
}, (prevProps, nextProps) => {
  // Return true if props are equal (skip render)
  return prevProps.expenses === nextProps.expenses;
});
```

---

## 10. CI/CD & Deployment

### 10.1 Build & Test Pipeline

```yaml
# .github/workflows/frontend.yml
name: FE CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npm run build

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
```

### 10.2 Deployment Strategy

**Dev Environment (Vercel):**

- Auto-deploy on `main` branch push
- Environment: `https://household-app-dev.vercel.app`

**Staging/Prod (Vercel + Manual):**

- Tag-based deployment: `git tag v1.0.0`
- Manual approval for staging/prod
- Rollback via previous tag

```bash
# Tag a release
git tag v1.0.0
git push origin v1.0.0

# Vercel auto-deploys based on tags
```

---

## 11. Security

### 11.1 XSS Prevention

```typescript
// ✅ CORRECT: React escapes by default
const name = '<script>alert("xss")</script>';
return <div>{name}</div>;  // Rendered as text, not executed

// ❌ WRONG: Never use dangerouslySetInnerHTML
return <div dangerouslySetInnerHTML={{ __html: name }} />;
```

### 11.2 CSRF Protection

```typescript
// Backend issues CSRF token in response headers
// Frontend attaches to POST/PUT/DELETE requests

apiClient.interceptors.request.use((config) => {
  const csrfToken = document
    .querySelector('meta[name="csrf-token"]')
    ?.getAttribute('content')
  if (
    csrfToken &&
    ['POST', 'PUT', 'DELETE'].includes(config.method?.toUpperCase())
  ) {
    config.headers['X-CSRF-Token'] = csrfToken
  }
  return config
})
```

### 11.3 Session Security

```typescript
// Only use HttpOnly cookies (set by backend)
// Frontend NEVER stores tokens in localStorage

// ✅ CORRECT: Session cookie (automatic)
apiClient.defaults.withCredentials = true

// ❌ WRONG: Storing token in localStorage
localStorage.setItem('token', jwtToken) // Vulnerable to XSS!
```

### 11.4 Environment Variables

```bash
# .env.example (safe to commit)
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=Household

# .env.local (NEVER commit)
# Only secrets with VITE_ prefix are exposed
```

---

## 12. Mobile Strategy (Capacitor.js)

### 12.1 Web + Mobile Architecture

```
React Web App (Household App)
        ↓
   Capacitor.js (wrapper)
        ↓
   ┌─────────────────┐
   │ iOS App         │
   │ Android App     │
   └─────────────────┘

Same React code → Web + Mobile
```

### 12.2 Native Plugin Integration

```typescript
// src/utils/capacitor.ts
import { Camera } from '@capacitor/camera'
import { Geolocation } from '@capacitor/geolocation'

export const takeCameraPhoto = async () => {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
    })
    return image.webPath
  } catch (error) {
    console.error(error)
  }
}

export const getUserLocation = async () => {
  const coordinates = await Geolocation.getCurrentPosition()
  return {
    lat: coordinates.coords.latitude,
    lng: coordinates.coords.longitude,
  }
}
```

### 12.3 Platform-Specific Conditionals

```typescript
import { Capacitor } from '@capacitor/core';

export const isPlatform = (platform: 'ios' | 'android' | 'web') => {
  return Capacitor.getPlatform() === platform;
};

// Usage
const ReceiptUpload = () => {
  if (isPlatform('web')) {
    return <input type="file" />;
  } else {
    return <button onClick={takeCameraPhoto}>Take Photo</button>;
  }
};
```

### 12.4 Build & Deploy

```bash
# Build web
npm run build

# Add Capacitor
npx cap add ios
npx cap add android

# Sync assets
npx cap sync

# Open in Xcode / Android Studio
npx cap open ios
npx cap open android

# Build for App Store / Play Store
# (Xcode / Android Studio handles signing + submission)
```

---

## 13. Module Structure

### Financial Module Example

```
modules/financial/
├── components/
│   ├── ExpenseForm.tsx
│   ├── ExpenseList.tsx
│   ├── ExpenseTable.tsx
│   ├── IncomeForm.tsx
│   ├── SavingsCard.tsx
│   └── FilterBar.tsx
│
├── hooks/
│   ├── useExpenses.ts      (TanStack Query wrapper)
│   ├── useIncome.ts
│   ├── useSavings.ts
│   ├── useExpenseCreate.ts (Mutation)
│   ├── useExpenseUpdate.ts (Mutation)
│   ├── useExpenseDelete.ts (Mutation)
│   └── useFinancialFilters.ts
│
├── pages/
│   ├── FinancialDashboard.tsx
│   ├── ExpensesPage.tsx
│   ├── IncomePage.tsx
│   └── SettingsPage.tsx
│
├── stores/
│   ├── expenseStore.ts
│   ├── filterStore.ts
│   └── statsStore.ts
│
├── types/
│   ├── expense.ts
│   ├── income.ts
│   ├── savings.ts
│   └── index.ts
│
├── api/
│   ├── queries.ts
│   └── mutations.ts
│
└── index.ts (export public API)
```

---

## Summary

**This FE Architecture ensures:**

- ✅ **Tenant-aware** — householdId in every query/component
- ✅ **Type-safe** — TypeScript strict mode
- ✅ **Testable** — Clear mocking boundaries, MSW for APIs
- ✅ **Performant** — Code splitting, TanStack Query caching, memoization
- ✅ **Secure** — Session cookies, XSS/CSRF protection
- ✅ **Scalable** — Module structure allows team expansion
- ✅ **Mobile-ready** — Capacitor.js for iOS/Android
- ✅ **DX** — Vite + Vitest for fast feedback

**Next:** See `BE-Architecture.md` for backend design (NestJS + Postgres + Multi-tenant).
