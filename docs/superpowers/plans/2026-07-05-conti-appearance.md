# Conti — Appearance: formatted currency input, color & icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere input valuta sempre formattato, palette colori e selettore icone per ogni conto nella schermata Conti.

**Architecture:** Tre nuovi componenti (`CurrencyInput`, `AccountAvatar`, `AccountIconColorPicker`) + due nuove colonne DB (`color`, `icon`) con migration Drizzle. Le route API vengono aggiornate per persistere i nuovi campi. `AccountRow` e `AddAccountForm` vengono integrati con i nuovi componenti.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM (Postgres), react-number-format, @base-ui/react (Popover), lucide-react, Vitest

## Global Constraints

- Package manager: `pnpm`
- Test runner: Vitest — `pnpm test`
- DB: `pnpm db:generate` (genera migration) poi `pnpm db:migrate` (applica)
- Colori UI: solo classi Tailwind o token CSS — no hex hardcoded
- Stringhe UI: in italiano
- Test API: Vitest + DB reale (no mock del DB) — seguire il pattern dei test in `app/api/accounts/`
- Import da fuori `components/domain/accounts/`: sempre da barrel `@/components/domain/accounts`
- Import interni alla cartella `accounts/`: diretti (`./account-avatar`, `./currency-input`, ecc.)

---

### Task 1: Installa react-number-format

**Files:**
- Modify: `package.json` (via pnpm)

**Interfaces:**
- Produces: `NumericFormat`, `OnValueChange` disponibili da `"react-number-format"`

- [ ] **Step 1: Installa la dipendenza**

```bash
pnpm add react-number-format
```

Expected: `+ react-number-format X.X.X` nel log pnpm. La lib include i tipi TypeScript nativamente, non serve `@types/`.

- [ ] **Step 2: Verifica TypeScript**

```bash
pnpm exec tsc --noEmit 2>&1 | head -5
```

Expected: nessun output (zero errori).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add react-number-format dependency"
```

---

### Task 2: Schema DB + costanti palette/icone + migration + fix test helper

**Files:**
- Modify: `lib/db/schema/accounts.ts`
- Modify: `lib/validation/accounts.ts`
- Create: `lib/db/migrations/0001_add_color_icon_accounts.sql` (generato da drizzle-kit)
- Modify: `components/domain/accounts/accounts-kpi.utils.test.ts`

**Interfaces:**
- Produces:
  - `ACCOUNT_COLORS: readonly AccountColor[]`, type `AccountColor`
  - `ACCOUNT_ICONS: readonly AccountIcon[]`, type `AccountIcon`
  - `createAccountSchema` e `updateAccountSchema` accettano `color?` e `icon?`
  - `Account` type (da `$inferSelect`) include `color: string` e `icon: string`

- [ ] **Step 1: Aggiungi colonne in `lib/db/schema/accounts.ts`**

Contenuto completo del file dopo la modifica:

```ts
import { numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { dataSourceEnum } from "./shared";
import { authUser } from "./auth";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => authUser.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  institution: text("institution"),
  type: text("type").notNull(),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  color: text("color").notNull().default("slate"),
  icon: text("icon").notNull().default("wallet"),
  source: dataSourceEnum("source").notNull().default("manuale"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
```

- [ ] **Step 2: Aggiungi costanti e aggiorna Zod in `lib/validation/accounts.ts`**

Contenuto completo del file dopo la modifica:

```ts
import { z } from "zod";

export const ACCOUNT_TYPE_OPTIONS = [
  "Conto corrente",
  "Conto risparmio",
  "Conto deposito",
  "Contanti",
] as const;

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

/** Converte una stringa importo (virgola o punto come separatore decimale) in numero, o null se non valida. */
export function parseAmount(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (normalized === "") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export const createAccountSchema = z.object({
  name: z.string().trim().min(1),
  institution: z.string().trim().optional(),
  type: z.string().trim().min(1),
  balance: z.number(),
  color: z.enum(ACCOUNT_COLORS).optional(),
  icon: z.enum(ACCOUNT_ICONS).optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    institution: z.string().trim().optional(),
    type: z.string().trim().min(1).optional(),
    balance: z.number().optional(),
    color: z.enum(ACCOUNT_COLORS).optional(),
    icon: z.enum(ACCOUNT_ICONS).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nessun campo da aggiornare",
  });

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
```

- [ ] **Step 3: Genera la migration**

```bash
pnpm db:generate
```

Drizzle-kit crea `lib/db/migrations/0001_*.sql`. Il contenuto SQL generato sarà simile a:
```sql
ALTER TABLE "accounts" ADD COLUMN "color" text DEFAULT 'slate' NOT NULL;
ALTER TABLE "accounts" ADD COLUMN "icon" text DEFAULT 'wallet' NOT NULL;
```

- [ ] **Step 4: Applica la migration**

```bash
pnpm db:migrate
```

Expected: log di successo senza errori.

- [ ] **Step 5: Aggiorna il test helper in `components/domain/accounts/accounts-kpi.utils.test.ts`**

Aggiungi `color` e `icon` all'oggetto in `makeAccount`:

```ts
function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    name: "Conto",
    institution: null,
    type: "Conto corrente",
    balance: "0.00",
    color: "slate",
    icon: "wallet",
    source: "manuale",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
```

- [ ] **Step 6: Esegui i test**

```bash
pnpm test
```

Expected: tutti i test passano.

- [ ] **Step 7: Commit**

```bash
git add lib/db/schema/accounts.ts lib/db/migrations/ lib/validation/accounts.ts components/domain/accounts/accounts-kpi.utils.test.ts
git commit -m "feat: add color and icon columns to accounts schema and validation"
```

---

### Task 3: getCurrencySymbol utility

**Files:**
- Modify: `lib/format.ts`
- Create: `lib/format.test.ts`

**Interfaces:**
- Produces: `getCurrencySymbol(currency: string, locale?: string): string`

- [ ] **Step 1: Scrivi il test in `lib/format.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { getCurrencySymbol } from "./format";

describe("getCurrencySymbol", () => {
  it("restituisce € per EUR con locale it-IT", () => {
    expect(getCurrencySymbol("EUR", "it-IT")).toBe("€");
  });

  it("restituisce $ per USD con locale en-US", () => {
    expect(getCurrencySymbol("USD", "en-US")).toBe("$");
  });

  it("usa it-IT come default locale", () => {
    expect(getCurrencySymbol("EUR")).toBe("€");
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisce**

```bash
pnpm test lib/format.test.ts
```

Expected: FAIL — `getCurrencySymbol is not a function`.

- [ ] **Step 3: Implementa in `lib/format.ts`**

Aggiungi dopo `formatCurrency`:

```ts
/**
 * Estrae il simbolo di valuta per un codice ISO 4217.
 * Formatta 0 con Intl e rimuove cifre, spazi (inclusi non-breaking) e separatori.
 */
export function getCurrencySymbol(currency: string, locale = "it-IT"): string {
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(0);
  return formatted.replace(/[\d\s  .,]/g, "").trim();
}
```

- [ ] **Step 4: Esegui il test per verificare che passa**

```bash
pnpm test lib/format.test.ts
```

Expected: PASS — 3 test superati.

- [ ] **Step 5: Commit**

```bash
git add lib/format.ts lib/format.test.ts
git commit -m "feat: add getCurrencySymbol utility"
```

---

### Task 4: AccountAvatar component

**Files:**
- Create: `components/domain/accounts/account-avatar.tsx`

**Interfaces:**
- Produces:
  - `AccountAvatar({ color: AccountColor, icon: AccountIcon, size?: number, className?: string })`
  - `ICON_MAP: Record<AccountIcon, LucideIcon>` — esportato, usato da `AccountIconColorPicker`
  - `AccountAvatarProps` — esportato

- [ ] **Step 1: Crea `components/domain/accounts/account-avatar.tsx`**

```tsx
/** Avatar conto: icona Lucide su cerchio colorato. */

import * as React from "react";
import {
  Wallet, CreditCard, Banknote, Building2, PiggyBank, TrendingUp,
  Home, Car, Plane, ShoppingCart, Briefcase, DollarSign, Bitcoin,
  Landmark, Coins, Receipt, Package, Gift, Heart, Star, Zap, Coffee,
  ShoppingBag, User, Globe, Smartphone, Watch, GraduationCap, Flame, Music,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";

export const ICON_MAP: Record<AccountIcon, LucideIcon> = {
  "wallet":         Wallet,
  "credit-card":    CreditCard,
  "banknote":       Banknote,
  "building-2":     Building2,
  "piggy-bank":     PiggyBank,
  "trending-up":    TrendingUp,
  "home":           Home,
  "car":            Car,
  "plane":          Plane,
  "shopping-cart":  ShoppingCart,
  "briefcase":      Briefcase,
  "dollar-sign":    DollarSign,
  "bitcoin":        Bitcoin,
  "landmark":       Landmark,
  "coins":          Coins,
  "receipt":        Receipt,
  "package":        Package,
  "gift":           Gift,
  "heart":          Heart,
  "star":           Star,
  "zap":            Zap,
  "coffee":         Coffee,
  "shopping-bag":   ShoppingBag,
  "user":           User,
  "globe":          Globe,
  "smartphone":     Smartphone,
  "watch":          Watch,
  "graduation-cap": GraduationCap,
  "flame":          Flame,
  "music":          Music,
};

const COLOR_MAP: Record<AccountColor, { bg: string; fg: string }> = {
  slate:  { bg: "bg-slate-100 dark:bg-slate-800",      fg: "text-slate-500 dark:text-slate-400" },
  blue:   { bg: "bg-blue-100 dark:bg-blue-900/40",     fg: "text-blue-600 dark:text-blue-400" },
  green:  { bg: "bg-green-100 dark:bg-green-900/40",   fg: "text-green-600 dark:text-green-400" },
  yellow: { bg: "bg-yellow-100 dark:bg-yellow-900/40", fg: "text-yellow-600 dark:text-yellow-400" },
  purple: { bg: "bg-purple-100 dark:bg-purple-900/40", fg: "text-purple-600 dark:text-purple-400" },
  orange: { bg: "bg-orange-100 dark:bg-orange-900/40", fg: "text-orange-600 dark:text-orange-400" },
  red:    { bg: "bg-red-100 dark:bg-red-900/40",       fg: "text-red-600 dark:text-red-400" },
  teal:   { bg: "bg-teal-100 dark:bg-teal-900/40",     fg: "text-teal-600 dark:text-teal-400" },
};

export interface AccountAvatarProps {
  color: AccountColor;
  icon: AccountIcon;
  size?: number;
  className?: string;
}

export function AccountAvatar({ color, icon, size = 16, className }: AccountAvatarProps) {
  const Icon = ICON_MAP[icon] ?? Wallet;
  const { bg, fg } = COLOR_MAP[color] ?? COLOR_MAP.slate;

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full",
        bg,
        className
      )}
      aria-hidden="true"
    >
      <Icon size={size} className={fg} />
    </div>
  );
}
```

- [ ] **Step 2: Verifica TypeScript**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "account-avatar"
```

Expected: nessun output.

- [ ] **Step 3: Commit**

```bash
git add components/domain/accounts/account-avatar.tsx
git commit -m "feat: add AccountAvatar component"
```

---

### Task 5: CurrencyInput component

**Files:**
- Create: `components/domain/accounts/currency-input.tsx`

**Interfaces:**
- Consumes: `getCurrencySymbol` da `@/lib/format`
- Produces: `CurrencyInput({ value: number | null, onChange: (v: number | null) => void, onBlur?: () => void, currency: string, className?: string, "aria-label"?: string })`, `CurrencyInputProps`

- [ ] **Step 1: Crea `components/domain/accounts/currency-input.tsx`**

```tsx
"use client";

/** Input valuta sempre formattato: simbolo statico + NumericFormat per la parte numerica. */

import * as React from "react";
import { NumericFormat } from "react-number-format";
import { cn } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/format";

export interface CurrencyInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur?: () => void;
  currency: string;
  className?: string;
  "aria-label"?: string;
}

export function CurrencyInput({
  value,
  onChange,
  onBlur,
  currency,
  className,
  "aria-label": ariaLabel,
}: CurrencyInputProps) {
  const symbol = getCurrencySymbol(currency);

  return (
    <div className="flex items-center gap-1">
      <span className="shrink-0 select-none text-xs text-muted-foreground">{symbol}</span>
      <NumericFormat
        value={value ?? ""}
        onValueChange={({ floatValue }) => onChange(floatValue ?? null)}
        onBlur={onBlur}
        thousandSeparator="."
        decimalSeparator=","
        decimalScale={2}
        allowNegative
        className={cn(
          "h-8 min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30",
          className
        )}
        aria-label={ariaLabel}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verifica TypeScript**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "currency-input"
```

Expected: nessun output.

- [ ] **Step 3: Commit**

```bash
git add components/domain/accounts/currency-input.tsx
git commit -m "feat: add CurrencyInput component"
```

---

### Task 6: AccountIconColorPicker component

**Files:**
- Create: `components/domain/accounts/account-icon-color-picker.tsx`

**Interfaces:**
- Consumes:
  - `ICON_MAP: Record<AccountIcon, LucideIcon>` da `./account-avatar`
  - `ACCOUNT_COLORS`, `ACCOUNT_ICONS`, `AccountColor`, `AccountIcon` da `@/lib/validation/accounts`
- Produces: `AccountIconColorPicker({ value: { color: AccountColor, icon: AccountIcon }, onChange: (v: { color, icon }) => void, children: React.ReactNode })`, `AccountIconColorPickerProps`

- [ ] **Step 1: Crea `components/domain/accounts/account-icon-color-picker.tsx`**

Usa `@base-ui/react/popover` direttamente (stesso pattern di `dropdown-menu.tsx` che usa `@base-ui/react/menu`).

```tsx
"use client";

/** Popover per scegliere colore e icona di un conto. Click sull'avatar apre il picker. */

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";
import { ACCOUNT_COLORS, ACCOUNT_ICONS } from "@/lib/validation/accounts";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";
import { ICON_MAP } from "./account-avatar";

const COLOR_DOT: Record<AccountColor, string> = {
  slate:  "bg-slate-400",
  blue:   "bg-blue-500",
  green:  "bg-green-500",
  yellow: "bg-yellow-400",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  red:    "bg-red-500",
  teal:   "bg-teal-500",
};

export interface AccountIconColorPickerProps {
  value: { color: AccountColor; icon: AccountIcon };
  onChange: (value: { color: AccountColor; icon: AccountIcon }) => void;
  children: React.ReactNode;
}

export function AccountIconColorPicker({
  value,
  onChange,
  children,
}: AccountIconColorPickerProps) {
  return (
    <Popover.Root>
      <Popover.Trigger className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className="z-50 w-64 rounded-xl border border-border bg-popover p-3 shadow-lg outline-none">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Colore</p>
            <div className="mb-4 flex gap-1.5">
              {ACCOUNT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onChange({ ...value, color })}
                  className={cn(
                    "size-6 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    COLOR_DOT[color],
                    value.color === color &&
                      "ring-2 ring-foreground ring-offset-2 ring-offset-popover"
                  )}
                  aria-label={color}
                  aria-pressed={value.color === color}
                />
              ))}
            </div>

            <p className="mb-2 text-xs font-medium text-muted-foreground">Icona</p>
            <div className="grid grid-cols-7 gap-1">
              {ACCOUNT_ICONS.map((icon) => {
                const Icon = ICON_MAP[icon];
                return (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => onChange({ ...value, icon })}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      value.icon === icon && "bg-accent text-accent-foreground"
                    )}
                    aria-label={icon}
                    aria-pressed={value.icon === icon}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

- [ ] **Step 2: Verifica TypeScript**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "account-icon-color-picker"
```

Expected: nessun output.

- [ ] **Step 3: Commit**

```bash
git add components/domain/accounts/account-icon-color-picker.tsx
git commit -m "feat: add AccountIconColorPicker component"
```

---

### Task 7: API routes — POST accetta color/icon, PATCH selettivo per conti auto

**Files:**
- Modify: `app/api/accounts/route.ts`
- Modify: `app/api/accounts/route.test.ts`
- Modify: `app/api/accounts/[id]/route.ts`
- Modify: `app/api/accounts/[id]/route.test.ts`

**Interfaces:**
- Consumes: `createAccountSchema` e `updateAccountSchema` con `color?` e `icon?` (da Task 2)
- Produces: POST e PATCH persistono `color` e `icon`; PATCH su conti auto restituisce 403 solo se il body contiene campi finanziari (`name`, `institution`, `type`, `balance`)

- [ ] **Step 1: Scrivi i nuovi test**

In `app/api/accounts/route.test.ts`, aggiungi dentro il `describe`:

```ts
it("salva color e icon personalizzati alla creazione", async () => {
  const postResponse = await POST(
    new NextRequest("http://localhost/api/accounts", {
      method: "POST",
      body: JSON.stringify({ name: "Test", type: "Contanti", balance: 0, color: "green", icon: "coins" }),
    })
  );
  expect(postResponse.status).toBe(201);
  const created = await postResponse.json();
  expect(created.color).toBe("green");
  expect(created.icon).toBe("coins");
});
```

In `app/api/accounts/[id]/route.test.ts`, aggiungi dentro il `describe`:

```ts
it("permette di aggiornare color e icon su un conto auto", async () => {
  const [account] = await db
    .insert(accounts)
    .values({ userId, name: "Conto auto", type: "Conto corrente", balance: "100.00", source: "auto" })
    .returning();

  const response = await PATCH(
    new NextRequest(`http://localhost/api/accounts/${account.id}`, {
      method: "PATCH",
      body: JSON.stringify({ color: "blue", icon: "credit-card" }),
    }),
    { params: Promise.resolve({ id: account.id }) }
  );

  expect(response.status).toBe(200);
  const updated = await response.json();
  expect(updated.color).toBe("blue");
  expect(updated.icon).toBe("credit-card");
});

it("risponde 403 su conto auto se il body contiene campi finanziari", async () => {
  const [account] = await db
    .insert(accounts)
    .values({ userId, name: "Conto auto", type: "Conto corrente", balance: "100.00", source: "auto" })
    .returning();

  const response = await PATCH(
    new NextRequest(`http://localhost/api/accounts/${account.id}`, {
      method: "PATCH",
      body: JSON.stringify({ balance: 250, color: "blue" }),
    }),
    { params: Promise.resolve({ id: account.id }) }
  );

  expect(response.status).toBe(403);
});
```

- [ ] **Step 2: Esegui i nuovi test per verificare che falliscono**

```bash
pnpm test app/api/accounts/
```

Expected: i 3 nuovi test falliscono; i test esistenti passano.

- [ ] **Step 3: Aggiorna `app/api/accounts/route.ts`**

```ts
import { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { createAccountSchema } from "@/lib/validation/accounts";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, session.user.id))
    .orderBy(asc(accounts.createdAt));

  return Response.json(userAccounts);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const body = await request.json();
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [account] = await db
    .insert(accounts)
    .values({
      userId: session.user.id,
      name: parsed.data.name,
      institution: parsed.data.institution ?? null,
      type: parsed.data.type,
      balance: parsed.data.balance.toFixed(2),
      source: "manuale",
      ...(parsed.data.color ? { color: parsed.data.color } : {}),
      ...(parsed.data.icon ? { icon: parsed.data.icon } : {}),
    })
    .returning();

  return Response.json(account, { status: 201 });
}
```

- [ ] **Step 4: Aggiorna `app/api/accounts/[id]/route.ts`**

```ts
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { updateAccountSchema } from "@/lib/validation/accounts";

const FINANCIAL_FIELDS = ["name", "institution", "type", "balance"] as const;

async function getOwnedAccount(userId: string, accountId: string) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
  return account ?? null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const { id } = await params;
  const account = await getOwnedAccount(session.user.id, id);
  if (!account) {
    return new Response(null, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (account.source === "auto") {
    const hasFinancialFields = FINANCIAL_FIELDS.some((k) => k in parsed.data);
    if (hasFinancialFields) {
      return Response.json(
        { error: "Un conto collegato automaticamente non può essere modificato" },
        { status: 403 }
      );
    }
  }

  const { balance, ...rest } = parsed.data;
  const [updated] = await db
    .update(accounts)
    .set({
      ...rest,
      ...(balance !== undefined ? { balance: balance.toFixed(2) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, id))
    .returning();

  return Response.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const { id } = await params;
  const account = await getOwnedAccount(session.user.id, id);
  if (!account) {
    return new Response(null, { status: 404 });
  }

  await db.delete(accounts).where(eq(accounts.id, id));
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 5: Esegui tutti i test API**

```bash
pnpm test app/api/accounts/
```

Expected: tutti i test passano inclusi i 3 nuovi.

- [ ] **Step 6: Commit**

```bash
git add app/api/accounts/route.ts app/api/accounts/route.test.ts app/api/accounts/[id]/route.ts app/api/accounts/[id]/route.test.ts
git commit -m "feat: accounts API accepts color/icon; PATCH allows appearance updates on auto accounts"
```

---

### Task 8: AccountRow refactor

**Files:**
- Modify: `components/domain/accounts/account-row.tsx`

**Interfaces:**
- Consumes:
  - `AccountAvatar({ color: AccountColor, icon: AccountIcon })` da `./account-avatar`
  - `AccountIconColorPicker({ value: { color, icon }, onChange, children })` da `./account-icon-color-picker`
  - `CurrencyInput({ value: number | null, onChange, onBlur, currency, className, aria-label })` da `./currency-input`
  - `ACCOUNT_COLORS`, `ACCOUNT_ICONS`, `AccountColor`, `AccountIcon`, `UpdateAccountInput` da `@/lib/validation/accounts`
  - `Account` include `color: string`, `icon: string` (da Task 2)

- [ ] **Step 1: Sostituisci il contenuto di `components/domain/accounts/account-row.tsx`**

```tsx
"use client";

/**
 * AccountRow
 *
 * Riga singola nella lista Conti. Conti manuali: tutti i campi editabili inline
 * (salvataggio on-blur / on-select). Conti auto: campi finanziari in sola lettura +
 * azione "Scollega"; icona e colore modificabili per entrambi i tipi.
 */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/format";
import {
  ACCOUNT_TYPE_OPTIONS,
  ACCOUNT_COLORS,
  ACCOUNT_ICONS,
} from "@/lib/validation/accounts";
import type { AccountColor, AccountIcon, UpdateAccountInput } from "@/lib/validation/accounts";
import { useDeleteAccountMutation, useUpdateAccountMutation } from "@/lib/queries/accounts";
import type { Account } from "@/lib/db/schema/accounts";
import { cn } from "@/lib/utils";
import { AccountAvatar } from "./account-avatar";
import { AccountIconColorPicker } from "./account-icon-color-picker";
import { CurrencyInput } from "./currency-input";

const CUSTOM_TYPE_VALUE = "__custom__";

export interface AccountRowProps {
  account: Account;
  currency: string;
}

export function AccountRow({ account, currency }: AccountRowProps) {
  const isAuto = account.source === "auto";
  const updateMutation = useUpdateAccountMutation();
  const deleteMutation = useDeleteAccountMutation();

  const [name, setName] = React.useState(account.name);
  const [institution, setInstitution] = React.useState(account.institution ?? "");
  const [type, setType] = React.useState(account.type);
  const [balanceValue, setBalanceValue] = React.useState<number | null>(
    Number(account.balance)
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isCustomType, setIsCustomType] = React.useState(
    () =>
      !ACCOUNT_TYPE_OPTIONS.includes(account.type as (typeof ACCOUNT_TYPE_OPTIONS)[number])
  );
  const [color, setColor] = React.useState<AccountColor>(
    (ACCOUNT_COLORS as readonly string[]).includes(account.color)
      ? (account.color as AccountColor)
      : "slate"
  );
  const [icon, setIcon] = React.useState<AccountIcon>(
    (ACCOUNT_ICONS as readonly string[]).includes(account.icon)
      ? (account.icon as AccountIcon)
      : "wallet"
  );

  function commitField(field: "name" | "institution" | "type", rawValue: string) {
    if (rawValue === (account[field] ?? "")) return;
    const input: UpdateAccountInput = { [field]: rawValue } as UpdateAccountInput;
    updateMutation.mutate({ id: account.id, input });
  }

  function commitBalance() {
    if (balanceValue === null) return;
    if (balanceValue === Number(account.balance)) return;
    updateMutation.mutate({ id: account.id, input: { balance: balanceValue } });
  }

  function commitAppearance(next: { color: AccountColor; icon: AccountIcon }) {
    const updates: UpdateAccountInput = {};
    if (next.color !== account.color) updates.color = next.color;
    if (next.icon !== account.icon) updates.icon = next.icon;
    if (Object.keys(updates).length === 0) return;
    setColor(next.color);
    setIcon(next.icon);
    updateMutation.mutate({ id: account.id, input: updates });
  }

  function handleDeleteConfirm() {
    deleteMutation.mutate(account.id);
    setDialogOpen(false);
  }

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <AccountIconColorPicker value={{ color, icon }} onChange={commitAppearance}>
        <AccountAvatar color={color} icon={icon} />
      </AccountIconColorPicker>

      <div className="min-w-0 flex-1 space-y-1">
        {isAuto ? (
          <p className="truncate text-sm font-medium text-foreground">{account.name}</p>
        ) : (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => commitField("name", name)}
            className="h-7 text-sm font-medium"
            aria-label="Nome conto"
          />
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {isAuto ? (
            <span>
              {account.institution ? `${account.institution} · ` : ""}
              {account.type}
            </span>
          ) : (
            <>
              <Input
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                onBlur={() => commitField("institution", institution)}
                placeholder="Istituto"
                className="h-6 w-32 text-xs"
                aria-label="Istituto"
              />
              <Select
                value={isCustomType ? CUSTOM_TYPE_VALUE : type}
                onValueChange={(value) => {
                  if (value === null) return;
                  if (value === CUSTOM_TYPE_VALUE) {
                    setIsCustomType(true);
                    return;
                  }
                  setIsCustomType(false);
                  setType(value);
                  commitField("type", value);
                }}
              >
                <SelectTrigger size="sm" className="h-6 text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_TYPE_VALUE}>Altro…</SelectItem>
                </SelectContent>
              </Select>
              {isCustomType && (
                <Input
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  onBlur={() => commitField("type", type)}
                  placeholder="Tipo personalizzato"
                  className="h-6 w-32 text-xs"
                  aria-label="Tipo personalizzato"
                />
              )}
            </>
          )}
        </div>
      </div>

      <Badge variant={isAuto ? "secondary" : "outline"}>{isAuto ? "Auto" : "Manuale"}</Badge>

      {isAuto ? (
        <p className="w-28 shrink-0 text-right text-sm font-medium tabular-nums">
          {formatCurrency(Number(account.balance), currency)}
        </p>
      ) : (
        <CurrencyInput
          value={balanceValue}
          onChange={setBalanceValue}
          onBlur={commitBalance}
          currency={currency}
          className="h-7 w-24 text-right text-sm font-medium tabular-nums"
          aria-label="Saldo"
        />
      )}

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogTrigger
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground",
            "hover:bg-destructive/10 hover:text-destructive"
          )}
          aria-label={isAuto ? "Scollega conto" : "Rimuovi conto"}
        >
          ✕
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isAuto ? "Scollegare questo conto?" : "Eliminare questo conto?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isAuto
                ? `"${account.name}" verrà scollegato. L'azione non è reversibile.`
                : `"${account.name}" verrà eliminato definitivamente, insieme al suo saldo registrato.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {isAuto ? "Scollega" : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 2: Verifica TypeScript**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "account-row"
```

Expected: nessun output.

- [ ] **Step 3: Commit**

```bash
git add components/domain/accounts/account-row.tsx
git commit -m "feat: AccountRow uses AccountAvatar, picker, and CurrencyInput"
```

---

### Task 9: AddAccountForm refactor + barrel update + page.tsx

**Files:**
- Modify: `components/domain/accounts/add-account-form.tsx`
- Modify: `components/domain/accounts/index.ts`
- Modify: `app/(app)/conti/page.tsx`

**Interfaces:**
- Consumes:
  - `AccountAvatar`, `AccountIconColorPicker`, `CurrencyInput` (da Task 4, 5, 6)
  - `AccountColor`, `AccountIcon` da `@/lib/validation/accounts`
- Produces: `AddAccountForm({ currency: string })` — aggiunto prop `currency` (era zero-prop)

**Nota:** `AddAccountForm` riceve `currency` come prop (non via `authClient.useSession()` internamente) — principio "props esplicite" da CLAUDE.md. La `conti/page.tsx` già legge `currency` dalla sessione e lo passa.

- [ ] **Step 1: Sostituisci `components/domain/accounts/add-account-form.tsx`**

```tsx
"use client";

/** Form "+ Aggiungi conto": crea un nuovo conto manuale con icona e colore personalizzabili. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/validation/accounts";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";
import { useCreateAccountMutation } from "@/lib/queries/accounts";
import { AccountAvatar } from "./account-avatar";
import { AccountIconColorPicker } from "./account-icon-color-picker";
import { CurrencyInput } from "./currency-input";

const CUSTOM_TYPE_VALUE = "__custom__";

export interface AddAccountFormProps {
  currency: string;
}

export function AddAccountForm({ currency }: AddAccountFormProps) {
  const createMutation = useCreateAccountMutation();

  const [name, setName] = React.useState("");
  const [institution, setInstitution] = React.useState("");
  const [type, setType] = React.useState<string>(ACCOUNT_TYPE_OPTIONS[0]);
  const [isCustomType, setIsCustomType] = React.useState(false);
  const [balanceValue, setBalanceValue] = React.useState<number | null>(0);
  const [color, setColor] = React.useState<AccountColor>("slate");
  const [icon, setIcon] = React.useState<AccountIcon>("wallet");
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim() === "" || type.trim() === "") {
      setError("Nome e tipo sono obbligatori");
      return;
    }

    createMutation.mutate(
      {
        name: name.trim(),
        institution: institution.trim() === "" ? undefined : institution.trim(),
        type: type.trim(),
        balance: balanceValue ?? 0,
        color,
        icon,
      },
      {
        onSuccess: () => {
          setName("");
          setInstitution("");
          setType(ACCOUNT_TYPE_OPTIONS[0]);
          setIsCustomType(false);
          setBalanceValue(0);
          setColor("slate");
          setIcon("wallet");
        },
        onError: (mutationError) => setError(mutationError.message),
      }
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 border-t border-border p-4"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Icona</label>
        <AccountIconColorPicker
          value={{ color, icon }}
          onChange={({ color: c, icon: i }) => {
            setColor(c);
            setIcon(i);
          }}
        >
          <AccountAvatar color={color} icon={icon} />
        </AccountIconColorPicker>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="new-account-name">
          Nome
        </label>
        <Input
          id="new-account-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-40"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="new-account-institution"
        >
          Istituto
        </label>
        <Input
          id="new-account-institution"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          className="w-40"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Tipo</label>
        <Select
          value={isCustomType ? CUSTOM_TYPE_VALUE : type}
          onValueChange={(value) => {
            if (value === CUSTOM_TYPE_VALUE) {
              setIsCustomType(true);
              setType("");
              return;
            }
            setIsCustomType(false);
            setType(value as string);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo conto" />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_TYPE_VALUE}>Altro…</SelectItem>
          </SelectContent>
        </Select>
        {isCustomType && (
          <Input
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="Tipo personalizzato"
            className="w-40"
          />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="new-account-balance"
        >
          Saldo iniziale
        </label>
        <CurrencyInput
          value={balanceValue}
          onChange={setBalanceValue}
          currency={currency}
          className="w-28"
          aria-label="Saldo iniziale"
        />
      </div>

      <Button type="submit" disabled={createMutation.isPending}>
        + Aggiungi conto
      </Button>

      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Aggiorna `app/(app)/conti/page.tsx` per passare `currency` ad `AddAccountForm`**

Modifica solo la riga `<AddAccountForm />`:

```tsx
<AddAccountForm currency={currency} />
```

Il file completo aggiornato:

```tsx
"use client";

/** Pagina Conti: orchestra fetch, KPI, lista conti e form di creazione. Nessuna logica di business qui. */

import { AccountsKpi, AccountRow, AddAccountForm } from "@/components/domain/accounts";
import { Card } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";
import { useAccountsQuery } from "@/lib/queries/accounts";

export default function ContiPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { data: accounts, isLoading, isError, refetch } = useAccountsQuery();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <h1 className="font-heading text-2xl font-medium text-foreground">Conti</h1>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Impossibile caricare i conti.{" "}
          <button onClick={() => refetch()} className="underline underline-offset-2">
            Riprova
          </button>
        </div>
      ) : (
        <AccountsKpi accounts={accounts ?? []} currency={currency} />
      )}

      <Card className="p-0">
        {!isLoading && !isError && (accounts ?? []).length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Nessun conto ancora. Aggiungine uno dal form qui sotto.
          </p>
        ) : (
          !isLoading &&
          !isError &&
          (accounts ?? []).map((account) => (
            <AccountRow key={account.id} account={account} currency={currency} />
          ))
        )}
        <AddAccountForm currency={currency} />
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Aggiorna il barrel `components/domain/accounts/index.ts`**

```ts
/**
 * components/domain/accounts — barrel file
 *
 * Punto di ingresso unico per i componenti della schermata Conti.
 */

export { AccountsKpi } from "./accounts-kpi";
export type { AccountsKpiProps } from "./accounts-kpi";
export { computeAccountsKpi } from "./accounts-kpi.utils";
export type { AccountsKpiResult } from "./accounts-kpi.utils";
export { AccountRow } from "./account-row";
export type { AccountRowProps } from "./account-row";
export { AddAccountForm } from "./add-account-form";
export type { AddAccountFormProps } from "./add-account-form";
export { AccountAvatar } from "./account-avatar";
export type { AccountAvatarProps } from "./account-avatar";
export { AccountIconColorPicker } from "./account-icon-color-picker";
export type { AccountIconColorPickerProps } from "./account-icon-color-picker";
export { CurrencyInput } from "./currency-input";
export type { CurrencyInputProps } from "./currency-input";
```

- [ ] **Step 4: Esegui tutti i test**

```bash
pnpm test
```

Expected: tutti i test passano.

- [ ] **Step 5: Verifica TypeScript completo**

```bash
pnpm exec tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add components/domain/accounts/add-account-form.tsx components/domain/accounts/index.ts app/"(app)"/conti/page.tsx
git commit -m "feat: AddAccountForm with currency prop, icon/color picker, formatted input; update barrel"
```
