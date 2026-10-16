# Conti — Appearance: formatted currency input, color & icon per account

**Date:** 2026-07-05
**Status:** approved, awaiting implementation plan

## Goal

Improve three visual/UX aspects of the Conti (Accounts) screen:
1. Balance input always formatted with the local currency (instead of a raw numeric string)
2. A user-chosen colour for each account (fixed palette of 8 colours)
3. A user-chosen Lucide icon for each account (~30 finance icons)

## Section 1 — Schema & persistence

### New columns in `accounts`

```sql
color text NOT NULL DEFAULT 'slate'
icon  text NOT NULL DEFAULT 'wallet'
```

Added in `lib/db/schema/accounts.ts`:

```ts
color: text("color").notNull().default("slate"),
icon:  text("icon").notNull().default("wallet"),
```

Migration generated with `pnpm drizzle-kit generate` → file `lib/db/migrations/0001_add_color_icon_accounts.sql`.

### Palette and icon constants

Defined in `lib/validation/accounts.ts` (already used as the collection point for validation + domain constants):

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

### Zod schema update

`createAccountSchema` and `updateAccountSchema` in `lib/validation/accounts.ts` extended with:

```ts
color: z.enum(ACCOUNT_COLORS).optional(),
icon:  z.enum(ACCOUNT_ICONS).optional(),
```

Both optional: if absent, the DB uses the default (`'slate'`/`'wallet'`).

## Section 2 — New components

### `CurrencyInput` (`components/domain/accounts/currency-input.tsx`)

Wraps `NumericFormat` from `react-number-format`. The currency symbol is a static `<span>` next to the input, not a prefix/suffix inside NumericFormat (avoids parsing ambiguity with multibyte symbols).

Separators: `.` for thousands, `,` for decimals (locale `it-IT`). The locale is not hardcoded in the component but derives from the `currency` prop — for now the separators are fixed because i18n is not implemented yet; when localisation is introduced, this component will be the place to update.

**Props:**
```ts
interface CurrencyInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur?: () => void;
  currency: string;        // ISO 4217, e.g. "EUR"
  className?: string;
  "aria-label"?: string;
}
```

`NumericFormat` emits `onValueChange({ floatValue })` — no manual parsing required.

The currency symbol is derived from `Intl.NumberFormat` by formatting `0` and stripping digits + separators from the resulting string. Helper function `getCurrencySymbol(currency: string, locale?: string): string` in `lib/format.ts`. Example: `getCurrencySymbol("EUR", "it-IT")` → `"€"`.

Layout:
```
<div className="flex items-center gap-1">
  <span className="text-xs text-muted-foreground">{symbol}</span>
  <NumericFormat ... />
</div>
```

### `AccountAvatar` (`components/domain/accounts/account-avatar.tsx`)

A 36×36px circle with a centred Lucide icon (16px). Props: `color: AccountColor`, `icon: AccountIcon`, `size?: number`, `className?`.

**Colour map** (slug → Tailwind classes):

| slug | background | icon |
|---|---|---|
| `slate` | `bg-slate-100 dark:bg-slate-800` | `text-slate-500` |
| `blue` | `bg-blue-100 dark:bg-blue-900/40` | `text-blue-600` |
| `green` | `bg-green-100 dark:bg-green-900/40` | `text-green-600` |
| `yellow` | `bg-yellow-100 dark:bg-yellow-900/40` | `text-yellow-600` |
| `purple` | `bg-purple-100 dark:bg-purple-900/40` | `text-purple-600` |
| `orange` | `bg-orange-100 dark:bg-orange-900/40` | `text-orange-600` |
| `red` | `bg-red-100 dark:bg-red-900/40` | `text-red-600` |
| `teal` | `bg-teal-100 dark:bg-teal-900/40` | `text-teal-600` |

**Icon map**: a `Record<AccountIcon, LucideIcon>` object with named imports from `lucide-react`. Falls back to `Wallet` if the slug is not recognised.

### `AccountIconColorPicker` (`components/domain/accounts/account-icon-color-picker.tsx`)

Popover (shadcn `Popover` component) triggered by the children passed as a render prop. Popover content:

```
┌────────────────────────────────┐
│  Colore                        │
│  ● ● ● ● ● ● ● ●  (8 dots)   │
│                                │
│  Icona                         │
│  [grid 7 columns × N rows]    │
└────────────────────────────────┘
```

Immediate selection (no "Conferma" — confirm). The selected colour dot and the selected icon show a highlight ring.

**Props:**
```ts
interface AccountIconColorPickerProps {
  value: { color: AccountColor; icon: AccountIcon };
  onChange: (value: { color: AccountColor; icon: AccountIcon }) => void;
  children: React.ReactNode; // trigger
}
```

## Section 3 — Integration

### `AccountRow`

- **Avatar**: replaces the `<div>` with initials by `<AccountIconColorPicker>` wrapping `<AccountAvatar>`. On change → two `commitField` calls: one for `color`, one for `icon`.
- **Balance display**: auto accounts — stays a `<p>` with `formatCurrency`. No `CurrencyInput` here: the field is read-only, the formatting is already correct.
- **Balance edit**: manual accounts — `<Input>` → `<CurrencyInput>`. State goes from `balanceText: string` to `balanceValue: number | null`. On blur → commit if the value changed.
- **Picker on auto accounts**: the icon/colour picker is active on auto accounts too (visual data is not financial data).

Addition to `commitField` to handle the new fields:
```ts
function commitField(field: "name" | "institution" | "type" | "balance" | "color" | "icon", rawValue: string | number) { ... }
```

### `AddAccountForm`

- Added local state: `color: AccountColor = "slate"`, `icon: AccountIcon = "wallet"`.
- Clickable avatar preview at the top of the form (before the text fields) — shows a preview of the account being created.
- Balance: `balanceText: string = "0"` → `balanceValue: number | null = 0`. `CurrencyInput` instead of `Input`.
- The submit payload includes `color` and `icon`.
- Reset on submit: `color` → `"slate"`, `icon` → `"wallet"`, `balanceValue` → `0`.

### API routes

**`POST /api/accounts`** (`app/api/accounts/route.ts`):
- `createAccountSchema` now includes optional `color?` and `icon?`.
- The INSERT includes the two fields (if present in the body, otherwise the DB default).

**`PATCH /api/accounts/[id]`** (`app/api/accounts/[id]/route.ts`):
- The 403 logic for auto accounts becomes selective: it blocks only if the body contains financial fields (`name`, `institution`, `type`, `balance`). `color` and `icon` go through for auto accounts too.
- Implementation: after the Zod parse, check `const hasFinancialFields = ["name","institution","type","balance"].some(k => k in parsed.data)`. If `isAuto && hasFinancialFields` → 403.

## Files touched

| File | Operation |
|---|---|
| `lib/db/schema/accounts.ts` | change — +2 columns |
| `lib/db/migrations/0001_add_color_icon_accounts.sql` | new (generated by drizzle-kit) |
| `lib/db/migrations/meta/` | updated by drizzle-kit |
| `lib/validation/accounts.ts` | change — +constants +Zod enum |
| `lib/format.ts` | change — +`getCurrencySymbol` |
| `components/domain/accounts/currency-input.tsx` | new |
| `components/domain/accounts/account-avatar.tsx` | new |
| `components/domain/accounts/account-icon-color-picker.tsx` | new |
| `components/domain/accounts/account-row.tsx` | change |
| `components/domain/accounts/add-account-form.tsx` | change |
| `components/domain/accounts/index.ts` | change — barrel update |
| `app/api/accounts/route.ts` | change |
| `app/api/accounts/[id]/route.ts` | change |

## Dependencies to add

```
pnpm add react-number-format
```

`react-number-format` is typed natively (no `@types/` needed).

## Out of scope

- Icon search in the picker (30 icons can be browsed without search)
- Colour chosen per account type (decision: per individual account)
- Emoji as icons
- Animations/transitions in the picker
