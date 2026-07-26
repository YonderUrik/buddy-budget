# Note transazioni + categorizzazione migliorata via campi GoCardless — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere `creditorName`/`debtorName` GoCardless come sorgente di un nome pulito per `description` (con fallback identico a oggi) e un campo `note` libero editabile su ogni transazione, senza toccare gli algoritmi di categorizzazione esistenti.

**Architecture:** Due nuove colonne nullable su `transactions` (`rawDescription`, `note`). `lib/gocardless/sync.ts` calcola `description` da `creditorName`/`debtorName` quando disponibili (fallback a `remittanceInformationUnstructured`, poi al letterale "Movimento bancario"), salvando il testo grezzo originale in `rawDescription`. `note` è editabile via l'endpoint PATCH esistente (già generico, nessuna modifica di route necessaria) e nel filtro testo di Spese. Nessuna modifica a `lib/gocardless/categorize.ts` o `lib/calc/categorize-suggestions.ts`: beneficiano automaticamente di un `description` più pulito.

**Tech Stack:** Next.js/TypeScript, Drizzle ORM (Postgres), Zod, TanStack Query, Vitest, shadcn/ui (`@base-ui/react` Popover, nuovo componente Textarea).

## Global Constraints

- Spec di riferimento: `docs/superpowers/specs/2026-07-26-transazioni-note-categorizzazione-migliorata-design.md`.
- Nessun backfill delle transazioni auto già sincronizzate (restano con `description` grezza esistente, `rawDescription`/`note` a `null`).
- Nessuna modifica a `lib/gocardless/categorize.ts` o `lib/calc/categorize-suggestions.ts` — l'algoritmo di matching resta identico, cambia solo l'input.
- `note` massimo 500 caratteri, stringa vuota (dopo trim) normalizzata a `null`.
- `note` editabile sia su transazioni `auto` sia `manuale` (unico campo che rompe la regola generale "auto è sola lettura" — scelta esplicita della spec).
- Tutte le stringhe visibili in UI in italiano, nessun colore/valore hardcoded fuori dai token tema (vedi `CLAUDE.md`).

---

### Task 1: Schema DB — colonne `rawDescription`/`note`

**Files:**
- Modify: `lib/db/schema/transactions.ts`
- Modify: `lib/calc/expenses.test.ts` (helper `makeTransaction`)
- Modify: `lib/calc/categorize-suggestions.test.ts` (helper `makeTransaction`)

**Interfaces:**
- Produces: `Transaction` (drizzle `$inferSelect`) con due nuove chiavi `rawDescription: string | null` e `note: string | null`, usate da tutti i task successivi.

- [ ] **Step 1: Aggiungi le colonne allo schema**

In `lib/db/schema/transactions.ts`, aggiungi due colonne nullable subito dopo `description`:

```ts
    description: text("description").notNull(),
    // Testo grezzo remittanceInformationUnstructured originale (solo transazioni auto, quando
    // GoCardless lo fornisce): usato per il tooltip quando `description` è stata sostituita dal
    // nome pulito creditorName/debtorName, mai per il matching di categorizzazione.
    rawDescription: text("raw_description"),
    // Nota libera dell'utente, editabile su transazioni auto e manuali.
    note: text("note"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
```

- [ ] **Step 2: Applica lo schema al DB**

Esegui, dalla directory in cui stai lavorando su questo piano (worktree o repo principale a seconda di dove è stato aperto questo checkout — **mai** da una directory diversa da quella con questo schema, altrimenti Drizzle legge lo schema sbagliato):

```bash
pnpm db:push
```

Aggiungere due colonne nullable è un'operazione non distruttiva (nessuna perdita dati attesa). Se `drizzle-kit push` mostra un prompt di conferma che sembra distruttivo (rinomina/drop di qualcosa), **fermati e chiedi conferma all'utente** invece di confermare alla cieca.

- [ ] **Step 3: Aggiorna gli helper di test esistenti per compilare con le nuove colonne**

In `lib/calc/expenses.test.ts`, nella funzione `makeTransaction`, aggiungi le due chiavi (il tipo `Transaction` ora le richiede, anche se nullable):

```ts
function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    accountId: "account-1",
    categoryId: "category-1",
    description: "Transazione",
    rawDescription: null,
    note: null,
    amount: "-10.00",
    excludedAmount: "0.00",
    date: "2026-02-10",
    source: "manuale",
    externalId: null,
    createdAt: new Date(),
    // ...resto invariato
```

Stessa modifica in `lib/calc/categorize-suggestions.test.ts`:

```ts
function makeTransaction(overrides: Partial<Transaction>): Transaction {
  counter += 1;
  return {
    id: overrides.id ?? `tx-${counter}`,
    userId: "user-1",
    accountId: "account-1",
    categoryId: "category-1",
    description: "Esselunga",
    rawDescription: null,
    note: null,
    amount: "-20.00",
    excludedAmount: "0.00",
    date: "2026-01-01",
    source: "manuale",
    externalId: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}
```

- [ ] **Step 4: Verifica che tutto compili e i test esistenti passino**

Run: `pnpm tsc --noEmit`
Expected: nessun errore.

Run: `pnpm vitest run lib/calc/expenses.test.ts lib/calc/categorize-suggestions.test.ts`
Expected: PASS (nessuna nuova asserzione ancora, solo verifica che l'helper aggiornato non rompa nulla).

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema/transactions.ts lib/calc/expenses.test.ts lib/calc/categorize-suggestions.test.ts
git commit -m "feat: aggiungi colonne rawDescription/note a transactions"
```

---

### Task 2: GoCardless client + sync — mapping creditorName/debtorName

**Files:**
- Modify: `lib/gocardless/client.ts`
- Modify: `lib/gocardless/sync.ts`
- Modify: `lib/gocardless/sync.test.ts`

**Interfaces:**
- Consumes: `Transaction.rawDescription`/`Transaction.note` (Task 1).
- Produces: nessuna nuova funzione esportata — cambia solo il valore calcolato internamente in `syncAccountLink` per `description`/`rawDescription` prima dell'insert.

- [ ] **Step 1: Aggiungi i due campi opzionali a `BankTransaction`**

In `lib/gocardless/client.ts`:

```ts
export interface BankTransaction {
  transactionId?: string;
  internalTransactionId?: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured?: string;
  bookingDate: string;
  creditorName?: string;
  debtorName?: string;
}
```

- [ ] **Step 2: Scrivi i nuovi test (falliranno finché non tocchi `sync.ts`)**

Aggiungi in `lib/gocardless/sync.test.ts`, dentro `describe("syncAccountLink", ...)`, tre nuovi casi (dopo il primo test esistente, prima di `"distingue le transazioni categorizzate..."`):

```ts
  it("usa creditorName come description su una spesa (importo negativo), salvando il testo grezzo in rawDescription", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "100.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-creditor",
          transactionAmount: { amount: "-20.00", currency: "EUR" },
          remittanceInformationUnstructured: "PAGAMENTO POS ESSELUNGA VIA ROMA COD.4471",
          creditorName: "ESSELUNGA SPA",
          bookingDate: "2026-07-01",
        },
      ],
      rateLimit: null,
    });

    await syncAccountLink(link, createMemoryStore());

    const [stored] = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(stored.description).toBe("ESSELUNGA SPA");
    expect(stored.rawDescription).toBe("PAGAMENTO POS ESSELUNGA VIA ROMA COD.4471");
  });

  it("usa debtorName come description su un'entrata (importo positivo)", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "100.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-debtor",
          transactionAmount: { amount: "500.00", currency: "EUR" },
          remittanceInformationUnstructured: "BONIFICO RIF.998877",
          debtorName: "MARIO ROSSI SRL",
          bookingDate: "2026-07-01",
        },
      ],
      rateLimit: null,
    });

    await syncAccountLink(link, createMemoryStore());

    const [stored] = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(stored.description).toBe("MARIO ROSSI SRL");
    expect(stored.rawDescription).toBe("BONIFICO RIF.998877");
  });

  it("senza creditorName/debtorName ricade sulla descrizione grezza, con rawDescription uguale a description", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "100.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-no-merchant",
          transactionAmount: { amount: "-8.00", currency: "EUR" },
          remittanceInformationUnstructured: "Supermercato",
          bookingDate: "2026-07-01",
        },
      ],
      rateLimit: null,
    });

    await syncAccountLink(link, createMemoryStore());

    const [stored] = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(stored.description).toBe("Supermercato");
    expect(stored.rawDescription).toBe("Supermercato");
  });

  it("senza nessun campo testuale ricade su 'Movimento bancario', con rawDescription null", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "100.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-empty",
          transactionAmount: { amount: "-3.00", currency: "EUR" },
          bookingDate: "2026-07-01",
        },
      ],
      rateLimit: null,
    });

    await syncAccountLink(link, createMemoryStore());

    const [stored] = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(stored.description).toBe("Movimento bancario");
    expect(stored.rawDescription).toBeNull();
  });
```

- [ ] **Step 3: Esegui i nuovi test per verificare che falliscano**

Run: `pnpm vitest run lib/gocardless/sync.test.ts`
Expected: FAIL sui 4 nuovi test (i campi `creditorName`/`debtorName` non esistono ancora nel tipo/logica, `rawDescription` non viene ancora scritto).

- [ ] **Step 4: Implementa il calcolo in `sync.ts`**

In `lib/gocardless/sync.ts`, sostituisci la riga 79 (`const description = ...`) con:

```ts
      const rawDescription = bankTransaction.remittanceInformationUnstructured ?? null;
      const isExpense = Number(bankTransaction.transactionAmount.amount) < 0;
      const merchantName = (isExpense ? bankTransaction.creditorName : bankTransaction.debtorName)?.trim();
      const description = merchantName || rawDescription || "Movimento bancario";
```

e aggiungi `rawDescription` ai valori dell'insert (accanto a `description:`):

```ts
        .values({
          userId: link.userId,
          accountId: link.accountId,
          categoryId,
          description,
          rawDescription,
          amount: bankTransaction.transactionAmount.amount,
          date: bankTransaction.bookingDate,
          source: "auto",
          externalId,
        })
```

- [ ] **Step 5: Esegui i test per verificare che passino**

Run: `pnpm vitest run lib/gocardless/sync.test.ts`
Expected: PASS su tutti i test (i 4 nuovi + tutti quelli preesistenti, invariati nel comportamento).

- [ ] **Step 6: Commit**

```bash
git add lib/gocardless/client.ts lib/gocardless/sync.ts lib/gocardless/sync.test.ts
git commit -m "feat: usa creditorName/debtorName GoCardless per description pulita, salva testo grezzo in rawDescription"
```

---

### Task 3: Validazione + PATCH `note`

**Files:**
- Modify: `lib/validation/transactions.ts`
- Modify: `lib/validation/transactions.test.ts`
- Modify: `app/api/transactions/[id]/route.test.ts`

**Interfaces:**
- Consumes: `Transaction.note` (Task 1).
- Produces: `UpdateTransactionInput` ora include `note?: string | null`, consumato da `useUpdateTransactionMutation` (Task 5) e da `PATCH /api/transactions/[id]` (nessuna modifica al codice della route: `note` non è in `MANUAL_ONLY_FIELDS` e passa già attraverso `...rest` nello `.set({...})`).

- [ ] **Step 1: Scrivi i test di validazione (falliranno finché non tocchi lo schema)**

Aggiungi in `lib/validation/transactions.test.ts`, dentro `describe("updateTransactionSchema", ...)`:

```ts
  it("accetta una nota valida", () => {
    const result = updateTransactionSchema.safeParse({ note: "Regalo compleanno di Marco" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBe("Regalo compleanno di Marco");
    }
  });

  it("normalizza una nota vuota (dopo trim) a null", () => {
    const result = updateTransactionSchema.safeParse({ note: "   " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBeNull();
    }
  });

  it("accetta esplicitamente null per cancellare la nota", () => {
    const result = updateTransactionSchema.safeParse({ note: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBeNull();
    }
  });

  it("rifiuta una nota oltre 500 caratteri", () => {
    const result = updateTransactionSchema.safeParse({ note: "a".repeat(501) });
    expect(result.success).toBe(false);
  });
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `pnpm vitest run lib/validation/transactions.test.ts`
Expected: FAIL (`note` non è ancora un campo dello schema).

- [ ] **Step 3: Aggiungi `note` a `updateTransactionSchema`**

In `lib/validation/transactions.ts`:

```ts
export const updateTransactionSchema = z
  .object({
    description: z.string().trim().min(1).optional(),
    categoryId: z.string().uuid().optional(),
    amount: z.number().positive().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida").optional(),
    excludedAmount: z.number().min(0).optional(),
    note: z
      .string()
      .trim()
      .max(500, "La nota non può superare 500 caratteri")
      .nullable()
      .optional()
      .transform((val) => (val === "" ? null : val)),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nessun campo da aggiornare",
  });
```

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `pnpm vitest run lib/validation/transactions.test.ts`
Expected: PASS.

- [ ] **Step 5: Scrivi i test API per `note` su transazioni auto e manuali**

Aggiungi in `app/api/transactions/[id]/route.test.ts`, dentro `describe("PATCH/DELETE /api/transactions/[id]", ...)` (dopo il test `"permette di cambiare categoria e 'dividi' su una transazione auto"`):

```ts
  it("permette di impostare una nota su una transazione manuale", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Spesa",
        amount: "-50.00",
        date: "2026-02-10",
        source: "manuale",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ note: "Regalo per Marco" }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.note).toBe("Regalo per Marco");
  });

  it("permette di impostare una nota su una transazione auto (unico campo libero anche per auto)", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Movimento sincronizzato",
        amount: "-50.00",
        date: "2026-02-10",
        source: "auto",
        externalId: "ext-note-auto",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ note: "Da controllare" }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.note).toBe("Da controllare");
  });

  it("cancella una nota esistente inviando null", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Spesa",
        note: "Nota precedente",
        amount: "-50.00",
        date: "2026-02-10",
        source: "manuale",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ note: null }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.note).toBeNull();
  });
```

- [ ] **Step 6: Esegui i test per verificare che passino**

Run: `pnpm vitest run app/api/transactions/[id]/route.test.ts`
Expected: PASS su tutti i test (nessuna modifica a `route.ts` necessaria: `note` non è in `MANUAL_ONLY_FIELDS` e passa già attraverso lo spread `...rest`).

- [ ] **Step 7: Commit**

```bash
git add lib/validation/transactions.ts lib/validation/transactions.test.ts "app/api/transactions/[id]/route.test.ts"
git commit -m "feat: aggiungi campo note a updateTransactionSchema, editabile su auto e manuali"
```

---

### Task 4: Ricerca testo — includi `note`

**Files:**
- Modify: `lib/calc/expenses.ts`
- Modify: `lib/calc/expenses.test.ts`

**Interfaces:**
- Consumes: `Transaction.note` (Task 1), `TransactionFilter` (esistente, invariata nella forma).
- Produces: nessuna nuova funzione esportata — `filterTransactions` matcha anche su `note`.

- [ ] **Step 1: Scrivi il test (fallirà finché non tocchi `filterTransactions`)**

Aggiungi in `lib/calc/expenses.test.ts`, dentro `describe("filterTransactions", ...)`:

```ts
  it("filtra per testo anche dentro la nota, oltre alla descrizione", () => {
    const transactions = [
      makeTransaction({ id: "t1", description: "Esselunga", note: null }),
      makeTransaction({ id: "t2", description: "PAYPAL *XYZ", note: "Regalo compleanno di Marco" }),
    ];
    const result = filterTransactions(transactions, { categoryId: null, searchText: "marco" });
    expect(result.map((t) => t.id)).toEqual(["t2"]);
  });
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `pnpm vitest run lib/calc/expenses.test.ts`
Expected: FAIL sul nuovo test (`note` non ancora incluso nel match).

- [ ] **Step 3: Aggiorna `filterTransactions`**

In `lib/calc/expenses.ts`:

```ts
/** Filtra le transazioni per categoria esatta e/o substring case-insensitive su descrizione o nota, in AND. */
export function filterTransactions(
  transactions: Transaction[],
  filter: TransactionFilter
): Transaction[] {
  const normalizedSearch = filter.searchText.trim().toLocaleLowerCase();
  return transactions.filter((t) => {
    if (filter.categoryId !== null && t.categoryId !== filter.categoryId) return false;
    if (normalizedSearch === "") return true;
    const descriptionMatch = t.description.toLocaleLowerCase().includes(normalizedSearch);
    const noteMatch = (t.note ?? "").toLocaleLowerCase().includes(normalizedSearch);
    return descriptionMatch || noteMatch;
  });
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `pnpm vitest run lib/calc/expenses.test.ts`
Expected: PASS su tutti i test del file.

- [ ] **Step 5: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts
git commit -m "feat: includi la nota nel filtro testo di Spese"
```

---

### Task 5: UI — icona/popover nota + tooltip descrizione grezza

**Files:**
- Create: `components/domain/expenses/transaction-note-popover.tsx`
- Modify: `components/domain/expenses/transaction-row.tsx`
- Create (via CLI): `components/ui/textarea.tsx`

**Interfaces:**
- Consumes: `Transaction` (Task 1, campi `note`/`rawDescription`), `useUpdateTransactionMutation` (`lib/queries/transactions.ts`, esistente), `UpdateTransactionInput` (Task 3, campo `note`).
- Produces: `TransactionNotePopover` (componente interno a `transaction-row.tsx`, non esportato dal barrel — usato solo lì, coerente con `SplitSlider` che invece è esportato perché riusato altrove; qui non c'è un secondo consumatore).

- [ ] **Step 1: Installa il componente Textarea di shadcn**

```bash
pnpm dlx shadcn@latest add textarea
```

Verifica che `components/ui/textarea.tsx` sia stato creato.

- [ ] **Step 2: Crea `TransactionNotePopover`**

Crea `components/domain/expenses/transaction-note-popover.tsx`:

```tsx
"use client";

/** Icona + popover per leggere/editare la nota libera di una transazione (auto o manuale). */

import * as React from "react";
import { NotebookPen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { Transaction } from "@/lib/db/schema/transactions";

const NOTE_MAX_LENGTH = 500;

export interface TransactionNotePopoverProps {
  transaction: Transaction;
}

export function TransactionNotePopover({ transaction }: TransactionNotePopoverProps) {
  const updateMutation = useUpdateTransactionMutation();
  const [note, setNote] = React.useState(transaction.note ?? "");
  const [open, setOpen] = React.useState(false);
  const hasNote = (transaction.note ?? "").trim() !== "";

  function commit() {
    if (note.trim() === (transaction.note ?? "")) return;
    updateMutation.mutate({ id: transaction.id, input: { note } });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) commit();
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className={
          hasNote
            ? "flex size-6 shrink-0 items-center justify-center rounded-md text-primary hover:bg-muted"
            : "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100"
        }
        aria-label={hasNote ? "Modifica nota" : "Aggiungi nota"}
        title={hasNote ? (transaction.note ?? undefined) : "Aggiungi nota"}
      >
        <NotebookPen className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX_LENGTH}
          placeholder="Aggiungi una nota (es. a cosa si riferisce questa spesa)"
          className="min-h-20 text-sm"
          aria-label="Nota transazione"
        />
        {updateMutation.isError && (
          <p className="mt-1 text-xs text-destructive">Salvataggio non riuscito, riprova.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 3: Integra in `TransactionRow`**

In `components/domain/expenses/transaction-row.tsx`:

1. Importa il nuovo componente accanto agli altri import locali:

```ts
import { CategoryAvatar } from "@/components/domain/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { TransactionNotePopover } from "./transaction-note-popover";
```

2. Aggiungi la classe `group` al contenitore della riga (necessaria perché l'icona nota vuota usi `group-hover:opacity-100`), sulla riga con `className="flex flex-wrap items-center gap-3 px-4 py-3"`:

```tsx
      <div className="group flex flex-wrap items-center gap-3 px-4 py-3">
```

3. Aggiorna il `title` della descrizione auto per mostrare il testo grezzo quando presente e diverso, sostituendo:

```tsx
            <p className="truncate text-sm font-medium text-foreground" title={transaction.description}>
              {transaction.description}
            </p>
```

con:

```tsx
            <p
              className="truncate text-sm font-medium text-foreground"
              title={
                transaction.rawDescription && transaction.rawDescription !== transaction.description
                  ? transaction.rawDescription
                  : transaction.description
              }
            >
              {transaction.description}
            </p>
```

4. Aggiungi `<TransactionNotePopover transaction={transaction} />` nel gruppo di badge/azioni a destra, subito prima del bottone "Dividi":

```tsx
          <TransactionNotePopover transaction={transaction} />

          <button
            type="button"
            onClick={() => setSplitOpen((open) => !open)}
```

- [ ] **Step 4: Verifica build e lint**

Run: `pnpm tsc --noEmit`
Expected: nessun errore.

Run: `pnpm lint`
Expected: nessun nuovo errore introdotto da questi file.

- [ ] **Step 5: Commit**

```bash
git add components/ui/textarea.tsx components/domain/expenses/transaction-note-popover.tsx components/domain/expenses/transaction-row.tsx
git commit -m "feat: icona/popover nota libera su TransactionRow, tooltip descrizione grezza"
```

---

## Nota per la verifica manuale (non automatizzabile in questo sandbox)

Nessun Postgres/Redis disponibile per un browser reale in questo ambiente agentico (stesso vincolo di sempre, vedi `CLAUDE.md`). Da verificare manualmente dall'utente dopo il merge:

- Una spesa auto con `creditorName` mostra il nome pulito come testo principale; hover mostra il testo grezzo originale in tooltip.
- L'icona nota compare (piena) solo quando c'è una nota; su una riga senza nota, l'icona appare comunque al hover/focus della riga per poterne aggiungere una.
- La nota si salva su entrambe le transazioni auto e manuali, resta dopo refresh.
- Cercare un termine presente solo nella nota (non nella descrizione) filtra correttamente la lista in Spese.
- Una vera sync GoCardless (sandbox) con una banca che espone `creditorName`/`debtorName` produce `description` pulita — dipende dalla banca sandbox usata, potrebbe non essere verificabile se la banca test non fornisce questi campi.
