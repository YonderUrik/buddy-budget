# Authentication with better-auth

**Date**: 2026-07-04
**Status**: approved

## Context

The base data model (accounts, categories, transactions, budgets) has been implemented and merged. The current `users` table is a conscious stub (id, currency, created_at) meant to be reshaped when real authentication arrives. This spec defines that reshaping and the whole authentication system.

## What this spec covers

- Postgres schema for the 4 auth tables (`auth_user`, `auth_session`, `auth_account`, `auth_verification`)
- better-auth configuration: magic link, Google OAuth, Drizzle adapter, `additionalFields`
- Routes and pages: `/login`, `/onboarding`, `/api/auth/[...all]`
- Next.js middleware for route protection and the onboarding redirect
- Session access patterns in server components, client components, Route Handlers
- Migration strategy from the `users` stub to the auth tables

## What it does NOT cover (out of scope)

- Rate limiting via Redis (better-auth uses its in-memory system by default; the Redis adapter will be added when the infra is ready)
- HTML templates for the magic link emails (plain text for now)
- i18n implementation: the `language` field on `auth_user` is not added in this phase because the i18n library has not been chosen yet; it will be added when that decision is made
- Any app screen: this spec only produces auth, middleware, and the onboarding page

---

## 1. Database schema

### Auth tables (new)

better-auth requires 4 tables. They all get the `auth_` prefix to avoid conflicts with the existing `accounts` domain table.

**`auth_user`**

| Column | Type | Notes |
|---|---|---|
| `id` | text, PK | better-auth uses text (not uuid) for the user id |
| `name` | text, not null | display name |
| `email` | text, not null, unique | |
| `email_verified` | boolean, not null, default false | |
| `image` | text, nullable | avatar URL (from Google OAuth) |
| `currency` | text, not null, default `'EUR'` | ISO 4217 code, set during onboarding; inherited from the `users` stub via `additionalFields` |
| `onboarding_completed` | boolean, not null, default false | false → redirect to `/onboarding` after login; true → normal access to the app |
| `created_at` | timestamp, not null | |
| `updated_at` | timestamp, not null | |

**`auth_session`**

| Column | Type | Notes |
|---|---|---|
| `id` | text, PK | |
| `user_id` | text, FK → `auth_user.id`, not null | |
| `token` | text, not null, unique | |
| `expires_at` | timestamp, not null | |
| `ip_address` | text, nullable | |
| `user_agent` | text, nullable | |
| `created_at` / `updated_at` | timestamp, not null | |

**`auth_account`**

| Column | Type | Notes |
|---|---|---|
| `id` | text, PK | |
| `user_id` | text, FK → `auth_user.id`, not null | |
| `account_id` | text, not null | id of the account at the OAuth provider |
| `provider_id` | text, not null | e.g. `"google"`, `"credential"` |
| `access_token` | text, nullable | |
| `refresh_token` | text, nullable | |
| `id_token` | text, nullable | |
| `expires_at` | timestamp, nullable | |
| `password` | text, nullable | unused (no password auth) |
| `created_at` / `updated_at` | timestamp, not null | |

**`auth_verification`**

| Column | Type | Notes |
|---|---|---|
| `id` | text, PK | |
| `identifier` | text, not null | the user's email |
| `value` | text, not null | magic link token |
| `expires_at` | timestamp, not null | |
| `created_at` / `updated_at` | timestamp, not null | |

### Domain table updates

The FKs in `categories`, `accounts`, `transactions`, `budgets` move from `users.id` to `auth_user.id`. The type of the `user_id` column becomes `text` (no longer `uuid`) to match the PK type of `auth_user`.

---

## 2. better-auth configuration

### `lib/auth/index.ts` — server only

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as authSchema from "@/lib/db/schema/auth";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authSchema.authUser,
      session: authSchema.authSession,
      account: authSchema.authAccount,
      verification: authSchema.authVerification,
    },
  }),
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await resend.emails.send({
          from: process.env.RESEND_FROM!,
          to: email,
          subject: "Il tuo link di accesso a BuddyBudget",
          text: `Clicca qui per accedere: ${url}\n\nIl link scade tra 10 minuti.`,
        });
      },
    }),
  ],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  user: {
    additionalFields: {
      currency: {
        type: "string",
        defaultValue: "EUR",
        required: false,
      },
      onboardingCompleted: {
        type: "boolean",
        defaultValue: false,
        required: false,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
```

### `lib/auth/client.ts` — client only

```ts
import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [magicLinkClient()],
});
```

### Environment variables

```
# .env.local
BETTER_AUTH_SECRET=          # long random string, signs session tokens
BETTER_AUTH_URL=             # e.g. http://localhost:3000
NEXT_PUBLIC_APP_URL=         # same as BETTER_AUTH_URL (used by the client)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
RESEND_FROM=                 # e.g. noreply@buddybudget.app
DATABASE_URL=                # already present (Neon in dev)
```

---

## 3. Routes and pages

### `/api/auth/[...all]/route.ts` — better-auth handler

```ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### `app/(auth)/login/page.tsx` — public page

Form with an email field and two CTAs:
- **"Continua con email"** ("Continue with email") → `authClient.signIn.magicLink({ email, callbackURL: "/" })`
- **"Continua con Google"** ("Continue with Google") → `authClient.signIn.social({ provider: "google", callbackURL: "/" })`

After the magic link is sent, the page shows a confirmation message ("Controlla la tua casella email" — "Check your inbox"). The link in the email leads to `/api/auth/[...all]`, which verifies the token and redirects to `callbackURL`; the middleware intercepts and handles onboarding if needed.

### `app/(auth)/onboarding/page.tsx` — semi-public

Accessible only to authenticated users with `onboarding_completed = false` (the middleware redirects everyone else). It collects:
- **Currency**: a select with the currencies supported at launch, default EUR

On submit it calls `POST /api/user/onboarding`. After the 200 response it redirects to `/`.

### `app/api/user/onboarding/route.ts`

```ts
// Updates currency and onboarding_completed on auth_user
const session = await auth.api.getSession({ headers: request.headers });
if (!session) return new Response(null, { status: 401 });

const { currency } = await request.json();
await db.update(authUser)
  .set({ currency, onboardingCompleted: true })
  .where(eq(authUser.id, session.user.id));

return new Response(null, { status: 200 });
```

---

## 4. Middleware

File: `middleware.ts` (project root).

Logic, in order:

1. **Public routes** (`/login`, `/api/auth/*`, `/_next/*`, `/favicon.ico`) → pass through without checks
2. **No session** → redirect to `/login?redirect=<current-url>`
3. **Valid session + `onboarding_completed = false`** → redirect to `/onboarding` (unless already on `/onboarding`)
4. **Valid session + onboarding completed** → let through

The session is read with:
```ts
const session = await auth.api.getSession({ headers: request.headers });
```

---

## 5. Session access patterns

### Server Components
```ts
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({ headers: await headers() });
// session?.user.id, session?.user.currency
```

### Client Components
```ts
import { authClient } from "@/lib/auth/client";

const { data: session, isPending } = authClient.useSession();
// session?.user.id, session?.user.currency
```

### Route Handlers
```ts
const session = await auth.api.getSession({ headers: request.headers });
if (!session) return new Response(null, { status: 401 });
// every Route Handler that returns personal data must have this check
```

**Convention**: Drizzle queries always use `where(eq(table.userId, session.user.id))` — never trust a `userId` passed by the client in the request body.

---

## 6. Migration strategy

**Starting point** (on `main`): `users` table with `id uuid`, `currency text`, `created_at timestamp`. The FKs of `categories`, `accounts`, `transactions`, `budgets` point to `users.id`.

**A single migration** run in a transaction:

1. Drop the FK constraints on all four child tables
2. Drop the `users` table
3. Create `auth_user`, `auth_session`, `auth_account`, `auth_verification`
4. Alter `user_id` in each child table from `uuid` to `text` (existing values are cast — irrelevant in dev with Neon, no real data)
5. Recreate the FK constraints `user_id → auth_user.id`
6. Recreate the index on `(user_id, date)` in `transactions` (it was on `uuid`, now on `text`)

**In development (Neon)**: `drizzle-kit push` — applies directly, no migration file generated. Fast to iterate.

**In production (future)**: `drizzle-kit generate` + `drizzle-kit migrate` for versioned `.sql` files. The transition is planned in the infra plan.

**Data to preserve**: none — we are in development, no real users.

---

## Resulting file structure

```
lib/
  auth/
    index.ts          auth instance (server only)
    client.ts         authClient (client only)
  db/
    schema/
      auth.ts         four auth_* tables (replaces users.ts)
      categories.ts   updated: user_id text → auth_user
      accounts.ts     updated: user_id text → auth_user
      transactions.ts updated: user_id text → auth_user
      budgets.ts      updated: user_id text → auth_user
      index.ts        updated barrel
app/
  (auth)/
    login/
      page.tsx
    onboarding/
      page.tsx
  api/
    auth/
      [...all]/
        route.ts
    user/
      onboarding/
        route.ts
middleware.ts
```

---

## Out of scope and future

**What we consciously skip**:
- **Redis rate limiting**: better-auth uses an in-memory system by default; the Redis adapter will be added when the infra plan resumes
- **HTML email templates**: plain text for now; a React Email component will be added if/when needed
- **`language` field on `auth_user`**: the i18n library has not been chosen yet; the field will be added together with that decision

**What is planned after this**:
- **Spese screen** (or another domain screen): the first UI spec that consumes the data model + auth
- **Infra plan** (k3s, CI/CD, Redis): when there is enough real application to deserve a deploy
