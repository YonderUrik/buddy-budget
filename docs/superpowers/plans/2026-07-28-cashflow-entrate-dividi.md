# Dividi/Escludi per le entrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abilitare il meccanismo "Dividi" (`excludedAmount`/`effectiveAmount`), oggi disponibile solo per le uscite, anche per le transazioni entrata — permettendo di escludere in tutto o in parte un'entrata (rimborsi, giroconti, storni) dal conteggio come reddito reale, ovunque nel motore di calcolo Cash flow.

**Architecture:** Nessuna modifica a schema/API/validazione — `excludedAmount` ed `effectiveAmount` sono già generici sul segno. Si rimuovono i guard `!isIncome` che nascondevano la UI "Dividi" per le entrate in `TransactionRow` e `AutoCategorizeWizard`, si rendono dinamiche (in base al segno) le etichette testuali di `SplitSlider` e dello slider interno del wizard, e si sostituisce `Number(t.amount)` con `effectiveAmount(t)` in ogni somma di entrate del motore `lib/calc/cashflow.ts`.

**Tech Stack:** Next.js App Router, TypeScript, React, vitest, TanStack Query.

## Global Constraints

- Tutte le stringhe visibili in italiano (i18n non ancora implementata).
- Nessun colore/raggio hardcoded: usa i token Tailwind/CSS var esistenti.
- Nessuna modifica a schema DB, validazione Zod, route API — il meccanismo `excludedAmount`/`effectiveAmount`/`isValidExcludedAmount` è già generico sul segno, non richiede modifiche.
- Package manager: `pnpm`. Test: `pnpm test` (= `vitest run`).
- Nessuno script `typecheck` dedicato: usa `pnpm exec tsc --noEmit` per la verifica di tipo dei task che toccano solo componenti React (nessuna convenzione di test automatico per `.tsx` in questo repo — solo `lib/calc/*.test.ts` esiste per questo piano).
- Il bottone "Dividi" mantiene lo stesso testo per entrambe le direzioni — solo il contenuto interno di `SplitSlider`/dello slider del wizard cambia in base al segno, nessuna nuova stringa "Escludi" separata.

---

## File Structure

**Modify:**
- `lib/calc/cashflow.ts` — sostituisce `Number(t.amount)` con `effectiveAmount(t)` in ogni somma di entrate.
- `lib/calc/cashflow.test.ts` — nuovi test di regressione per il punto sopra.
- `components/domain/expenses/transaction-row.tsx` — rimuove il guard che nasconde "Dividi" per le entrate.
- `components/domain/expenses/split-slider.tsx` — etichetta/testo dinamici in base al segno dell'importo.
- `components/domain/expenses/auto-categorize-wizard.tsx` — rimuove il guard che nasconde lo slider di split per le entrate, etichette dinamiche, `onConfirm` non azzera più `excludedAmount` per le entrate.

---

### Task 1: Motore di calcolo — le entrate contano l'importo effettivo post-"Dividi"

**Files:**
- Modify: `lib/calc/cashflow.ts`
- Test: `lib/calc/cashflow.test.ts`

**Interfaces:**
- Consuma: `effectiveAmount` (già importata in `cashflow.ts` da `./expenses`, nessun nuovo import necessario).
- Produce: nessuna nuova funzione/tipo esportato — cambia solo il comportamento interno di `computeCashflowKpis`, `computeMonthlySeries`, `computeIncomeSources`, `computeWhereItGoes` (firme invariate).

- [ ] **Step 1: Scrivi i test falliti**

Aggiungi questi 4 test (uno per funzione toccata) nei rispettivi blocchi `describe` già esistenti in `lib/calc/cashflow.test.ts`.

Nel blocco `describe("computeCashflowKpis", ...)` (dopo il test `"conta come uscita solo la spesa effettiva post-'Dividi' (amount - excludedAmount)"`, prima della chiusura `});` del describe):

```typescript
  it("conta come entrata solo la quota effettiva post-'Dividi' (amount - excludedAmount)", () => {
    const transactions = [
      makeTransaction({ amount: "1000.00", excludedAmount: "400.00", date: "2026-01-10" }), // effettiva: 600
    ];

    const kpis = computeCashflowKpis(transactions, range, todayAfterPeriod);

    expect(kpis.entrateMedie).toBe(300); // 600 di entrata effettiva totale ÷ 2 mesi
  });
```

Nel blocco `describe("computeMonthlySeries", ...)` (dopo il test `"conta come uscita solo la spesa effettiva post-'Dividi'"`, prima della chiusura `});` del describe):

```typescript
  it("conta come entrata solo la quota effettiva post-'Dividi'", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) };
    const transactions = [
      makeTransaction({ amount: "1000.00", excludedAmount: "400.00", date: "2026-01-10" }),
    ];

    const series = computeMonthlySeries(transactions, range);

    expect(series[0].entrate).toBe(600);
  });
```

Nel blocco `describe("computeIncomeSources", ...)` (dopo il test `"include un'entrata sulla categoria fallback..."`, prima della chiusura `});` del describe):

```typescript
  it("conta come entrata solo la quota effettiva post-'Dividi', sia nel totale sia per categoria", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) };
    const stipendio = makeCategory({ id: "cat-stipendio", name: "Stipendio", type: "entrata" });
    const transactions = [
      makeTransaction({
        categoryId: "cat-stipendio",
        amount: "1000.00",
        excludedAmount: "400.00",
        date: "2026-01-05",
      }), // effettiva: 600
    ];

    const sources = computeIncomeSources(transactions, [stipendio], range);

    expect(sources[0].amount).toBe(600);
    expect(sources[0].quotaPct).toBeCloseTo(100);
  });
```

Nel blocco `describe("computeWhereItGoes", ...)` (dopo il test `"conta come spesa solo l'importo effettivo post-'Dividi'"`, prima della chiusura `});` del describe):

```typescript
  it("conta come entrata solo la quota effettiva post-'Dividi' nel totale usato come denominatore", () => {
    const fissa = makeCategory({ id: "cat-fissa", type: "fissa" });
    const transactions = [
      makeTransaction({ categoryId: "cat-fissa", amount: "-400.00", date: "2026-02-05" }),
      makeTransaction({
        categoryId: "category-1",
        amount: "1000.00",
        excludedAmount: "400.00",
        date: "2026-02-01",
      }), // effettiva: 600
    ];

    const entries = computeWhereItGoes(transactions, [fissa], new Date(2026, 1, 15));

    expect(entries.find((e) => e.key === "fisse")?.quotaPct).toBeCloseTo((400 / 600) * 100);
    expect(entries.find((e) => e.key === "risparmio")?.amount).toBe(200); // 600 - 400
  });
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `pnpm exec vitest run lib/calc/cashflow.test.ts`
Expected: FAIL sui 4 nuovi test (i valori attesi non corrispondono, perché il codice attuale somma `Number(t.amount)` grezzo invece di `effectiveAmount(t)`).

- [ ] **Step 3: Implementa il cambiamento minimo**

In `lib/calc/cashflow.ts`, sostituisci ciascuna delle 4 righe seguenti (identificale per contenuto esatto, non per numero di riga — il file può essere leggermente diverso da questa descrizione):

Riga in `computeCashflowKpis`:
```typescript
  const entrate = inRange.filter(isIncome).reduce((sum, t) => sum + Number(t.amount), 0);
```
diventa:
```typescript
  const entrate = inRange.filter(isIncome).reduce((sum, t) => sum + effectiveAmount(t), 0);
```

Riga in `computeMonthlySeries` (dentro l'oggetto ritornato dalla `.map`):
```typescript
      entrate: inMonth.filter(isIncome).reduce((sum, t) => sum + Number(t.amount), 0),
```
diventa:
```typescript
      entrate: inMonth.filter(isIncome).reduce((sum, t) => sum + effectiveAmount(t), 0),
```

Due righe in `computeIncomeSources`:
```typescript
  const totalEntrate = inRange.reduce((sum, t) => sum + Number(t.amount), 0);
```
diventa:
```typescript
  const totalEntrate = inRange.reduce((sum, t) => sum + effectiveAmount(t), 0);
```
e:
```typescript
    amountByCategoryId.set(t.categoryId, (amountByCategoryId.get(t.categoryId) ?? 0) + Number(t.amount));
```
diventa:
```typescript
    amountByCategoryId.set(t.categoryId, (amountByCategoryId.get(t.categoryId) ?? 0) + effectiveAmount(t));
```

Riga in `computeWhereItGoes`:
```typescript
  const entrate = inMonth.filter(isIncome).reduce((sum, t) => sum + Number(t.amount), 0);
```
diventa:
```typescript
  const entrate = inMonth.filter(isIncome).reduce((sum, t) => sum + effectiveAmount(t), 0);
```

Nessuna modifica alle firme delle funzioni, nessun `Math.abs` necessario: `effectiveAmount` per un'entrata (amount positivo, excludedAmount con lo stesso segno per costruzione — vedi `isValidExcludedAmount`) resta positivo.

Aggiorna anche i commenti JSDoc che menzionano esplicitamente "le uscite contano la spesa effettiva post-'Dividi'" per riflettere che ora vale anche per le entrate — cerca le stringhe `"Le uscite contano solo la spesa effettiva post-\"Dividi\""` (JSDoc di `computeCashflowKpis`) e `"Serie mensile entrate/uscite per ciascun mese calendariale nel range (inclusi i mesi senza transazioni, a 0). Le uscite contano la spesa effettiva post-\"Dividi\"."` (JSDoc di `computeMonthlySeries`) e riformulale per menzionare entrambe le direzioni, es. "Entrate e uscite contano solo l'importo effettivo post-'Dividi' (`effectiveAmount`)."

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `pnpm exec vitest run lib/calc/cashflow.test.ts`
Expected: PASS (tutti i test, inclusi i 4 nuovi e tutti quelli preesistenti).

- [ ] **Step 5: Verifica tipo e suite completa**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

Run: `pnpm test`
Expected: solo eventuali fallimenti pre-esistenti e non correlati (es. `lib/gocardless/scheduler.test.ts`), nessun nuovo fallimento.

- [ ] **Step 6: Commit**

```bash
git add lib/calc/cashflow.ts lib/calc/cashflow.test.ts
git commit -m "feat: entrate contano l'importo effettivo post-Dividi nel motore Cash flow"
```

---

### Task 2: `TransactionRow` — bottone "Dividi" visibile anche per le entrate

**Files:**
- Modify: `components/domain/expenses/transaction-row.tsx`

**Interfaces:**
- Consuma: nessuna nuova dipendenza — `SplitSlider` (Task 3) resta importata come oggi, riceve `transaction` per intero e determina da sola la direzione.
- Produce: nessuna nuova prop pubblica — `TransactionRowProps` invariata.

- [ ] **Step 1: Rimuovi il guard che nasconde "Dividi" per le entrate**

In `components/domain/expenses/transaction-row.tsx`, sostituisci:

```typescript
          {!isIncome && (
            <button
              type="button"
              onClick={() => setSplitOpen((open) => !open)}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
              aria-pressed={splitOpen}
            >
              Dividi
            </button>
          )}
```

con:

```typescript
          <button
            type="button"
            onClick={() => setSplitOpen((open) => !open)}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
            aria-pressed={splitOpen}
          >
            Dividi
          </button>
```

Il resto del componente (badge "Diviso", importo "Netto", `netAmount`/`isSplit`) non richiede modifiche: sono già scritti con `Math.abs(...)` e funzionano correttamente per importi positivi.

- [ ] **Step 2: Verifica di tipo**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/transaction-row.tsx
git commit -m "feat: mostra bottone Dividi anche sulle transazioni entrata"
```

---

### Task 3: `SplitSlider` — etichetta e testo esplicativo dinamici in base al segno

**Files:**
- Modify: `components/domain/expenses/split-slider.tsx`

**Interfaces:**
- Consuma: `transaction.amount` (già disponibile via prop `transaction`, nessuna nuova prop necessaria).
- Produce: `SplitSliderProps` invariata.

- [ ] **Step 1: Deriva la direzione e sostituisci il testo esplicativo statico**

In `components/domain/expenses/split-slider.tsx`, dentro `SplitSlider`, subito dopo la riga `const totalAmount = Math.abs(Number(transaction.amount));`, aggiungi:

```typescript
  const isIncome = Number(transaction.amount) > 0;
```

Sostituisci:

```typescript
      <p className="text-xs text-muted-foreground">
        Sposta il cursore per escludere una parte dal conteggio: è uscita dal conto, ma non è una spesa
        (rimborsi, quote di altri, giroconto).
      </p>
```

con:

```typescript
      <p className="text-xs text-muted-foreground">
        {isIncome
          ? "Sposta il cursore per escludere una parte dal conteggio: è entrata sul conto, ma non è reddito reale (rimborsi, giroconto, storni)."
          : "Sposta il cursore per escludere una parte dal conteggio: è uscita dal conto, ma non è una spesa (rimborsi, quote di altri, giroconto)."}
      </p>
```

- [ ] **Step 2: Etichetta dinamica del campo numerico**

Sostituisci:

```typescript
        <label htmlFor={`spesa-effettiva-${transaction.id}`} className="text-xs text-muted-foreground">
          Spesa effettiva
        </label>
```

con:

```typescript
        <label htmlFor={`spesa-effettiva-${transaction.id}`} className="text-xs text-muted-foreground">
          {isIncome ? "Entrata effettiva" : "Spesa effettiva"}
        </label>
```

(l'attributo `id`/`htmlFor` resta `spesa-effettiva-${transaction.id}` per entrambe le direzioni — è un identificatore interno, non testo visibile, non serve differenziarlo).

- [ ] **Step 3: Etichetta dinamica nel riepilogo sotto lo slider**

Sostituisci:

```typescript
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Spesa effettiva: {formatCurrency(totalAmount - excluded, currency)}</span>
        <span>Esclusa dal conteggio: {formatCurrency(excluded, currency)}</span>
      </div>
```

con:

```typescript
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {isIncome ? "Entrata effettiva" : "Spesa effettiva"}: {formatCurrency(totalAmount - excluded, currency)}
        </span>
        <span>Esclusa dal conteggio: {formatCurrency(excluded, currency)}</span>
      </div>
```

- [ ] **Step 4: Aggiorna il JSDoc del file**

Sostituisci la prima riga del file:

```typescript
/** UI "Dividi": ripartisce l'importo di una transazione tra spesa effettiva e quota esclusa dal conteggio. */
```

con:

```typescript
/** UI "Dividi": ripartisce l'importo di una transazione (spesa o entrata) tra quota effettiva e quota esclusa dal conteggio. */
```

- [ ] **Step 5: Verifica di tipo**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add components/domain/expenses/split-slider.tsx
git commit -m "feat: SplitSlider mostra etichette dedicate per le entrate"
```

---

### Task 4: `AutoCategorizeWizard` — split visibile anche per le entrate

**Files:**
- Modify: `components/domain/expenses/auto-categorize-wizard.tsx`

**Interfaces:**
- Consuma: nessuna nuova dipendenza.
- Produce: nessuna nuova prop pubblica — `AutoCategorizeWizardProps`/`AutoCategorizeStepProps` invariate. Il comportamento di `onConfirm`/`handleConfirm` cambia (non azzera più `excludedAmount` per le entrate).

- [ ] **Step 1: Rimuovi il guard che nasconde lo slider di split per le entrate, rendi dinamiche le etichette**

In `components/domain/expenses/auto-categorize-wizard.tsx`, dentro `AutoCategorizeStep`, sostituisci:

```typescript
        {!isIncome && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">Dividi (quota esclusa dal conteggio)</p>
            <Slider
              value={[excluded]}
              min={0}
              max={totalAmount}
              step={0.01}
              onValueChange={(value) =>
                setExcluded(clampExcluded(Array.isArray(value) ? value[0] : value, totalAmount))
              }
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Spesa effettiva: {formatCurrency(totalAmount - excluded, currency)}</span>
              <span>Esclusa: {formatCurrency(excluded, currency)}</span>
            </div>
          </div>
        )}
```

con:

```typescript
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">Dividi (quota esclusa dal conteggio)</p>
          <Slider
            value={[excluded]}
            min={0}
            max={totalAmount}
            step={0.01}
            onValueChange={(value) =>
              setExcluded(clampExcluded(Array.isArray(value) ? value[0] : value, totalAmount))
            }
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {isIncome ? "Entrata effettiva" : "Spesa effettiva"}: {formatCurrency(totalAmount - excluded, currency)}
            </span>
            <span>Esclusa: {formatCurrency(excluded, currency)}</span>
          </div>
        </div>
```

- [ ] **Step 2: Passa sempre `excluded` a `onConfirm`, non più azzerato per le entrate**

Sostituisci:

```typescript
        <Button
          type="button"
          onClick={() => onConfirm(categoryId, isIncome ? 0 : excluded)}
          disabled={isPending}
        >
          {isPending ? "Salvataggio..." : "Conferma"}
        </Button>
```

con:

```typescript
        <Button type="button" onClick={() => onConfirm(categoryId, excluded)} disabled={isPending}>
          {isPending ? "Salvataggio..." : "Conferma"}
        </Button>
```

- [ ] **Step 3: Verifica di tipo**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore. Nota: la variabile `isIncome` resta usata (per il filtro categorie e per l'etichetta dinamica), quindi non diventa un import/variabile inutilizzata.

- [ ] **Step 4: Commit**

```bash
git add components/domain/expenses/auto-categorize-wizard.tsx
git commit -m "feat: abilita Dividi anche per le entrate nel wizard Categorizza automaticamente"
```

---

## Verifica finale

Dopo il Task 4, esegui in sequenza:

```bash
pnpm exec tsc --noEmit
pnpm test
```

Nessun nuovo errore di tipo, nessun nuovo test fallito rispetto alla baseline nota (solo eventuali fallimenti pre-esistenti e non correlati in `lib/gocardless/scheduler.test.ts`).

Verifica manuale utente (nessun Postgres/Redis garantito nel sandbox agentico): aprire una transazione entrata in Transazioni, cliccare "Dividi", verificare che lo slider mostri "Entrata effettiva" e il testo esplicativo corretto, escludere una quota e verificare che il KPI/le liste in Cash flow riflettano solo la quota netta; ripetere lo stesso controllo dal wizard "Categorizza automaticamente" su una transazione entrata proposta.
