# Autenticazione con better-auth

**Data**: 2026-07-04
**Stato**: approvato

## Contesto

Il modello dati di base (conti, categorie, transazioni, budget) è stato implementato e mergiato. La tabella `users` attuale è uno stub consapevole (id, currency, created_at) pensato per essere rimodellato all'arrivo dell'autenticazione vera. Questo spec definisce quel rimodellamento e l'intero sistema di autenticazione.

## Cosa questo spec copre

- Schema Postgres per le 4 tabelle auth (`auth_user`, `auth_session`, `auth_account`, `auth_verification`)
- Configurazione better-auth: magic link, Google OAuth, Drizzle adapter, `additionalFields`
- Route e pagine: `/login`, `/onboarding`, `/api/auth/[...all]`
- Middleware Next.js per protezione route e redirect onboarding
- Pattern di accesso alla sessione in server components, client components, Route Handlers
- Strategia di migrazione dallo stub `users` alle tabelle auth

## Cosa NON copre (fuori scope)

- Rate limiting via Redis (better-auth usa il suo sistema in-memory come default; Redis adapter da aggiungere quando l'infra sarà pronta)
- Template HTML per le email del magic link (testo semplice per ora)
- Implementazione i18n: il campo `language` su `auth_user` non viene aggiunto in questa fase perché la libreria i18n non è ancora scelta; si aggiunge quando quella decisione viene presa
- Qualunque schermata dell'app: questo spec produce solo auth, middleware, e la pagina onboarding

---

## 1. Schema database

### Tabelle auth (nuove)

better-auth richiede 4 tabelle. Tutte ricevono il prefisso `auth_` per evitare conflitti con la tabella di dominio `accounts` già esistente.

**`auth_user`**

| Colonna | Tipo | Note |
|---|---|---|
| `id` | text, PK | better-auth usa text (non uuid) per l'id utente |
| `name` | text, not null | nome visualizzato |
| `email` | text, not null, unique | |
| `email_verified` | boolean, not null, default false | |
| `image` | text, nullable | URL avatar (da Google OAuth) |
| `currency` | text, not null, default `'EUR'` | codice ISO 4217, impostato in onboarding; ereditato dallo stub `users` via `additionalFields` |
| `onboarding_completed` | boolean, not null, default false | false → redirect a `/onboarding` dopo il login; true → accesso normale all'app |
| `created_at` | timestamp, not null | |
| `updated_at` | timestamp, not null | |

**`auth_session`**

| Colonna | Tipo | Note |
|---|---|---|
| `id` | text, PK | |
| `user_id` | text, FK → `auth_user.id`, not null | |
| `token` | text, not null, unique | |
| `expires_at` | timestamp, not null | |
| `ip_address` | text, nullable | |
| `user_agent` | text, nullable | |
| `created_at` / `updated_at` | timestamp, not null | |

**`auth_account`**

| Colonna | Tipo | Note |
|---|---|---|
| `id` | text, PK | |
| `user_id` | text, FK → `auth_user.id`, not null | |
| `account_id` | text, not null | id dell'account presso il provider OAuth |
| `provider_id` | text, not null | es. `"google"`, `"credential"` |
| `access_token` | text, nullable | |
| `refresh_token` | text, nullable | |
| `id_token` | text, nullable | |
| `expires_at` | timestamp, nullable | |
| `password` | text, nullable | non usato (no password auth) |
| `created_at` / `updated_at` | timestamp, not null | |

**`auth_verification`**

| Colonna | Tipo | Note |
|---|---|---|
| `id` | text, PK | |
| `identifier` | text, not null | email dell'utente |
| `value` | text, not null | token del magic link |
| `expires_at` | timestamp, not null | |
| `created_at` / `updated_at` | timestamp, not null | |

### Aggiornamento tabelle di dominio

Le FK in `categories`, `accounts`, `transactions`, `budgets` passano da `users.id` ad `auth_user.id`. Il tipo della colonna `user_id` rimane `text` (non più `uuid`) per allinearsi al tipo PK di `auth_user`.

---

## 2. Configurazione better-auth

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

### Variabili d'ambiente

```
# .env.local
BETTER_AUTH_SECRET=          # stringa random lunga, firma token sessione
BETTER_AUTH_URL=             # es. http://localhost:3000
NEXT_PUBLIC_APP_URL=         # uguale a BETTER_AUTH_URL (usato dal client)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
RESEND_FROM=                 # es. noreply@buddybudget.app
DATABASE_URL=                # già presente (Neon in dev)
```

---

## 3. Route e pagine

### `/api/auth/[...all]/route.ts` — handler better-auth

```ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### `app/(auth)/login/page.tsx` — pagina pubblica

Form con un campo email e due CTA:
- **"Continua con email"** → `authClient.signIn.magicLink({ email, callbackURL: "/" })`
- **"Continua con Google"** → `authClient.signIn.social({ provider: "google", callbackURL: "/" })`

Dopo l'invio del magic link la pagina mostra un messaggio di conferma ("Controlla la tua casella email"). Il link nell'email porta a `/api/auth/[...all]`, che verifica il token e redirige a `callbackURL`; il middleware intercetta e gestisce l'onboarding se necessario.

### `app/(auth)/onboarding/page.tsx` — semi-pubblica

Accessibile solo a utenti autenticati con `onboarding_completed = false` (il middleware redirige tutti gli altri). Raccoglie:
- **Valuta**: select con le valute supportate al lancio, default EUR

Al submit chiama `POST /api/user/onboarding`. Dopo la risposta 200 redirige a `/`.

### `app/api/user/onboarding/route.ts`

```ts
// Aggiorna currency e onboarding_completed su auth_user
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

File: `middleware.ts` (root del progetto).

Logica in ordine:

1. **Route pubbliche** (`/login`, `/api/auth/*`, `/_next/*`, `/favicon.ico`) → passa senza controllo
2. **Nessuna sessione** → redirect a `/login?redirect=<url-corrente>`
3. **Sessione valida + `onboarding_completed = false`** → redirect a `/onboarding` (eccetto se si è già su `/onboarding`)
4. **Sessione valida + onboarding completato** → lascia passare

La sessione si legge con:
```ts
const session = await auth.api.getSession({ headers: request.headers });
```

---

## 5. Pattern di accesso alla sessione

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
// ogni Route Handler che restituisce dati personali deve avere questo controllo
```

**Convenzione**: le query Drizzle usano sempre `where(eq(table.userId, session.user.id))` — mai fidarsi di un `userId` passato dal client nel body della richiesta.

---

## 6. Strategia di migrazione

**Situazione di partenza** (su `main`): tabella `users` con `id uuid`, `currency text`, `created_at timestamp`. Le FK di `categories`, `accounts`, `transactions`, `budgets` puntano a `users.id`.

**Una singola migration** eseguita in transazione:

1. Drop FK constraints su tutte e quattro le tabelle figlie
2. Drop tabella `users`
3. Crea `auth_user`, `auth_session`, `auth_account`, `auth_verification`
4. Altera `user_id` in ciascuna tabella figlia da `uuid` a `text` (i valori esistenti vengono castati — in dev con Neon è irrilevante, nessun dato reale)
5. Ricrea FK constraints `user_id → auth_user.id`
6. Ricrea indice su `(user_id, date)` in `transactions` (era su `uuid`, ora su `text`)

**In sviluppo (Neon)**: `drizzle-kit push` — applica direttamente, nessun file di migration generato. Veloce da iterare.

**In produzione (futuro)**: `drizzle-kit generate` + `drizzle-kit migrate` per file `.sql` versionati. La transizione è prevista nel piano infra.

**Dati da preservare**: nessuno — siamo in fase di sviluppo, nessun utente reale.

---

## Struttura file prodotta

```
lib/
  auth/
    index.ts          istanza auth (server only)
    client.ts         authClient (client only)
  db/
    schema/
      auth.ts         quattro tabelle auth_* (sostituisce users.ts)
      categories.ts   aggiornato: user_id text → auth_user
      accounts.ts     aggiornato: user_id text → auth_user
      transactions.ts aggiornato: user_id text → auth_user
      budgets.ts      aggiornato: user_id text → auth_user
      index.ts        barrel aggiornato
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

## Fuori scope e futuro

**Cosa saltiamo consapevolmente**:
- **Redis rate limiting**: better-auth usa un sistema in-memory di default; Redis adapter da aggiungere quando il piano infra riprenderà
- **Template email HTML**: testo semplice per ora; un componente React Email si aggiunge se/quando serve
- **Campo `language` su `auth_user`**: la libreria i18n non è ancora scelta; il campo viene aggiunto insieme a quella decisione

**Cosa è previsto dopo questo**:
- **Schermata Spese** (o altra schermata di dominio): primo spec UI che consuma il modello dati + auth
- **Piano infra** (k3s, CI/CD, Redis): quando ci sarà abbastanza applicazione reale da meritare un deploy
