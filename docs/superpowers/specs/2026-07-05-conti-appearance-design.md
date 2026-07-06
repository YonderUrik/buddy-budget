# Conti — Appearance: formatted currency input, color & icon per account

**Data:** 2026-07-05
**Stato:** approvato, in attesa di piano implementativo

## Obiettivo

Migliorare tre aspetti visuali/UX della schermata Conti:
1. Input saldo sempre formattato con valuta locale (invece di stringa numerica grezza)
2. Colore scelto dall'utente per ogni conto (palette fissa 8 colori)
3. Icona Lucide scelta dall'utente per ogni conto (~30 icone finanziarie)

## Sezione 1 — Schema & persistenza

### Nuove colonne in `accounts`

```sql
color text NOT NULL DEFAULT 'slate'
icon  text NOT NULL DEFAULT 'wallet'
```

Aggiunte in `lib/db/schema/accounts.ts`:

```ts
color: text("color").notNull().default("slate"),
icon:  text("icon").notNull().default("wallet"),
```

Migration generata con `pnpm drizzle-kit generate` → file `lib/db/migrations/0001_add_color_icon_accounts.sql`.

### Costanti palette e icone

Definite in `lib/validation/accounts.ts` (già usato come punto di raccolta per validazione + costanti domain):

```ts
export const ACCOUNT_COLORS = [
  "slate", "blue", "green", "yellow", "purple", "orange", "red", "teal",
] as const;
export type AccountColor = (typeof ACCOUNT_COLORS)[number];

export const ACCOUNT_ICONS = [
  "wallet", "credit-card", "banknote", "building-2", "piggy-bank",
  "trending-up", "home", "car", "plane", "shopping-cart", "briefcase",
  "dollar-sign", "bitcoin", "landmark", "coins", "receipt", "package",
  "gift", "heart", "star", "zap", "coffee", "shopping-bag", "user",
  "globe", "smartphone", "watch", "graduation-cap", "flame", "music",
] as const;
export type AccountIcon = (typeof ACCOUNT_ICONS)[number];
```

### Aggiornamento schema Zod

`createAccountSchema` e `updateAccountSchema` in `lib/validation/accounts.ts` estesi con:

```ts
color: z.enum(ACCOUNT_COLORS).optional(),
icon:  z.enum(ACCOUNT_ICONS).optional(),
```

Entrambi opzionali: se assenti il DB usa il default (`'slate'`/`'wallet'`).

## Sezione 2 — Nuovi componenti

### `CurrencyInput` (`components/domain/accounts/currency-input.tsx`)

Wrappa `NumericFormat` da `react-number-format`. Il simbolo valuta è uno `<span>` statico adiacente all'input, non un prefix/suffix dentro NumericFormat (evita ambiguità di parsing con simboli multibyte).

Separatori: `.` migliaia, `,` decimali (locale `it-IT`). Il locale non è hardcoded nel componente ma deriva dal prop `currency` — per ora i separatori sono fissi perché l'i18n non è ancora implementato; quando sarà introdotta la localizzazione, questo componente sarà il punto da aggiornare.

**Props:**
```ts
interface CurrencyInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur?: () => void;
  currency: string;        // ISO 4217, es. "EUR"
  className?: string;
  "aria-label"?: string;
}
```

`NumericFormat` emette `onValueChange({ floatValue })` — nessun parsing manuale richiesto.

Il simbolo valuta viene derivato da `Intl.NumberFormat` formattando `0` e strippando cifre + separatori dalla stringa risultante. Funzione helper `getCurrencySymbol(currency: string, locale?: string): string` in `lib/format.ts`. Esempio: `getCurrencySymbol("EUR", "it-IT")` → `"€"`.

Layout:
```
<div className="flex items-center gap-1">
  <span className="text-xs text-muted-foreground">{symbol}</span>
  <NumericFormat ... />
</div>
```

### `AccountAvatar` (`components/domain/accounts/account-avatar.tsx`)

Cerchio 36×36px con icona Lucide centrata (16px). Props: `color: AccountColor`, `icon: AccountIcon`, `size?: number`, `className?`.

**Mappa colori** (slug → classi Tailwind):

| slug | background | icona |
|---|---|---|
| `slate` | `bg-slate-100 dark:bg-slate-800` | `text-slate-500` |
| `blue` | `bg-blue-100 dark:bg-blue-900/40` | `text-blue-600` |
| `green` | `bg-green-100 dark:bg-green-900/40` | `text-green-600` |
| `yellow` | `bg-yellow-100 dark:bg-yellow-900/40` | `text-yellow-600` |
| `purple` | `bg-purple-100 dark:bg-purple-900/40` | `text-purple-600` |
| `orange` | `bg-orange-100 dark:bg-orange-900/40` | `text-orange-600` |
| `red` | `bg-red-100 dark:bg-red-900/40` | `text-red-600` |
| `teal` | `bg-teal-100 dark:bg-teal-900/40` | `text-teal-600` |

**Mappa icone**: oggetto `Record<AccountIcon, LucideIcon>` con import named da `lucide-react`. Fallback su `Wallet` se slug non riconosciuto.

### `AccountIconColorPicker` (`components/domain/accounts/account-icon-color-picker.tsx`)

Popover (componente `Popover` shadcn) triggerato dal children passato come render prop. Contenuto del popover:

```
┌────────────────────────────────┐
│  Colore                        │
│  ● ● ● ● ● ● ● ●  (8 dot)    │
│                                │
│  Icona                         │
│  [grid 7 colonne × N righe]   │
└────────────────────────────────┘
```

Selezione immediata (no "Conferma"). Il dot colore selezionato e l'icona selezionata mostrano un ring di evidenza.

**Props:**
```ts
interface AccountIconColorPickerProps {
  value: { color: AccountColor; icon: AccountIcon };
  onChange: (value: { color: AccountColor; icon: AccountIcon }) => void;
  children: React.ReactNode; // trigger
}
```

## Sezione 3 — Integrazione

### `AccountRow`

- **Avatar**: sostituisce `<div>` con iniziali con `<AccountIconColorPicker>` che wrappa `<AccountAvatar>`. On change → due chiamate `commitField`: una per `color`, una per `icon`.
- **Saldo display**: conti auto — rimane `<p>` con `formatCurrency`. Nessun `CurrencyInput` qui: il campo è read-only, la formattazione è già corretta.
- **Saldo edit**: conti manuali — `<Input>` → `<CurrencyInput>`. Stato da `balanceText: string` a `balanceValue: number | null`. On blur → commit se valore cambiato.
- **Picker su conti auto**: il picker icona/colore è attivo anche per conti auto (i dati visuali non sono dati finanziari).

Aggiunta a `commitField` per gestire i nuovi campi:
```ts
function commitField(field: "name" | "institution" | "type" | "balance" | "color" | "icon", rawValue: string | number) { ... }
```

### `AddAccountForm`

- Stato locale aggiunto: `color: AccountColor = "slate"`, `icon: AccountIcon = "wallet"`.
- Avatar preview cliccabile in testa al form (prima dei campi testo) — mostra anteprima del conto in creazione.
- Saldo: `balanceText: string = "0"` → `balanceValue: number | null = 0`. `CurrencyInput` al posto di `Input`.
- Submit payload include `color` e `icon`.
- Reset al submit: `color` → `"slate"`, `icon` → `"wallet"`, `balanceValue` → `0`.

### API routes

**`POST /api/accounts`** (`app/api/accounts/route.ts`):
- `createAccountSchema` ora include `color?` e `icon?` opzionali.
- INSERT include i due campi (se presenti nel body, altrimenti DB default).

**`PATCH /api/accounts/[id]`** (`app/api/accounts/[id]/route.ts`):
- La logica 403 per conti auto viene resa selettiva: blocca solo se il body contiene campi finanziari (`name`, `institution`, `type`, `balance`). `color` e `icon` passano anche per conti auto.
- Implementazione: dopo il parse Zod, controllare `const hasFinancialFields = ["name","institution","type","balance"].some(k => k in parsed.data)`. Se `isAuto && hasFinancialFields` → 403.

## File toccati

| File | Operazione |
|---|---|
| `lib/db/schema/accounts.ts` | modifica — +2 colonne |
| `lib/db/migrations/0001_add_color_icon_accounts.sql` | nuovo (generato da drizzle-kit) |
| `lib/db/migrations/meta/` | aggiornato da drizzle-kit |
| `lib/validation/accounts.ts` | modifica — +costanti +enum Zod |
| `lib/format.ts` | modifica — +`getCurrencySymbol` |
| `components/domain/accounts/currency-input.tsx` | nuovo |
| `components/domain/accounts/account-avatar.tsx` | nuovo |
| `components/domain/accounts/account-icon-color-picker.tsx` | nuovo |
| `components/domain/accounts/account-row.tsx` | modifica |
| `components/domain/accounts/add-account-form.tsx` | modifica |
| `components/domain/accounts/index.ts` | modifica — barrel update |
| `app/api/accounts/route.ts` | modifica |
| `app/api/accounts/[id]/route.ts` | modifica |

## Dipendenze da aggiungere

```
pnpm add react-number-format
```

`react-number-format` è typed natively (non serve `@types/`).

## Fuori scope

- Ricerca icone nel picker (30 icone sono navigabili senza search)
- Colore scelto per tipo conto (decisione: per singolo conto)
- Emoji come icone
- Animazioni/transizioni nel picker
