# Frontend

Next.js 16 application with React 19, TypeScript, and Tailwind CSS.

## Quick Start

```bash
npm install
npm run dev          # Development (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint check
npm test             # Product unit tests
```

## Tech Stack

- **Next.js 16** - App Router, Server Components
- **React 19** - UI library
- **TypeScript 5** - Type safety
- **Tailwind CSS 4** - Styling
- **RTK Query** - API state management
- **shadcn/ui** - UI components
- **next-intl** - Internationalization (en/ar)

## Project Structure

```
src/
├── app/[locale]/           # App Router pages (i18n)
│   ├── (auth)/             # Auth pages (login, register, etc.)
│   ├── (dashboard)/        # Protected dashboard pages
│   └── layout.tsx          # Root layout
├── components/             # Shared components
│   ├── ui/                 # shadcn/ui components
│   ├── forms/              # Form components
│   └── navigation/         # Nav components
├── modules/                # Feature modules
│   ├── auth/               # Core auth (login, register, password reset)
│   ├── oauth/              # OAuth (buttons, API, utils)
│   ├── account/            # Account settings (profile, linked accounts)
│   ├── roles/              # Role management (CRUD, API)
│   ├── users/              # User management (admin)
│   ├── permissions/        # Permission guards & utilities
│   └── sessions/           # Session management
├── store/                  # Redux store
│   └── api/                # RTK Query APIs
├── hooks/                  # Custom hooks
├── lib/                    # Utilities
├── i18n/                   # Translations (en.json, ar.json)
└── types/                  # TypeScript types
```

## Environment Variables

Create `frontend/.env.local`:

```bash
# Backend origin without /api suffix
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The frontend discovers enabled OAuth providers and active auth options dynamically from the backend via `GET /api/auth/methods` and `GET /api/auth/oauth/providers`.

## Key Features

### Auth Module (`src/modules/auth/`)

- Login/Register forms with validation
- Password reset flow
- Core authentication logic

### OAuth Module (`src/modules/oauth/`)

- OAuth buttons (Google, Facebook, GitHub)
- OAuth API and utilities
- Provider icons and styles

### Account Module (`src/modules/account/`)

- Profile management (update name)
- Change password
- Linked accounts management
- Profile sync status

### Roles Module (`src/modules/roles/`)

- Role CRUD operations
- Role detail panel
- Role sidebar navigation

### Users Module (`src/modules/users/`)

- User management (admin)
- User cards and lists
- User role selector

### Sessions Module (`src/modules/sessions/`)

- Active sessions list
- Device info parsing
- Session termination
- Bulk logout

### Permissions Module (`src/modules/permissions/`)

- Permission guards
- Permission utilities
- Permission selector components

## Development

### Path Aliases

Use `@/` for imports from `src/`:

```typescript
import { Button } from '@/components/ui/button';
import { useAuth } from '@/modules/auth/hooks';
```

### Server vs Client Components

```typescript
// Server Component (default)
export default function Page() {
  return <div>Server rendered</div>;
}

// Client Component (when needed)
'use client';
export default function Form() {
  const [state, setState] = useState();
  return <form>...</form>;
}
```

Use `'use client'` only when using hooks, event handlers, or browser APIs.

### Adding UI Components

```bash
npx shadcn@latest add button dialog
```

## Testing

Run `npm test` for product unit tests. The following browser commands are for the original source repository only. Its full-feature Playwright harness is maintainer tooling; generated projects omit that harness, its configurations and these commands. Generated projects retain product unit tests and the backend functional API suite (`npm run test:e2e -w backend` from the project root).

```bash
npm run test:e2e          # Run all E2E tests
npm run test:e2e:ui       # Interactive UI mode
npm run test:e2e:headed   # See browser
npm run test:e2e:debug    # Debug mode
```

Source repository browser files: `e2e/*.spec.ts`.

## Deployment

### Vercel

```bash
vercel login
vercel           # Preview
vercel --prod    # Production
```

Set environment variables in Vercel dashboard.

### Docker

Use `docker compose up` from root directory.

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [RTK Query](https://redux-toolkit.js.org/rtk-query/overview)
- [Backend API](../backend/README.md)
