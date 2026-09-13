# Panoramica — patrimonio netto nel tempo

**Data**: 2026-09-13
**Stato**: design approvato, piano di implementazione da scrivere
**Schermata**: Panoramica (home), oggi segnaposto in `app/(app)/page.tsx`

## Obiettivo

La home deve dare **a colpo d'occhio** il senso del patrimonio dell'utente e di come sta andando, aggregando le sezioni esistenti (Conti, Transazioni, Cash flow) e predisponendo l'arrivo di quelle future (Investimenti, Pensione, Debiti) senza doverla ridisegnare. Requisito non negoziabile dell'utente: **un grafico temporale dell'andamento del patrimonio netto**. Tutto il resto deve restare minimale.

## Vincolo tecnico di partenza

Il DB non ha alcuno storico dei saldi: `accounts.balance` è un singolo valore corrente. Inoltre le transazioni manuali **non** aggiornano `accounts.balance` (lo scrivono solo `POST`/`PATCH /api/accounts` e il sync GoCardless in `lib/gocardless/sync.ts`): per i conti manuali saldo e movimenti sono scollegati.

## Decisioni prese in brainstorming

| Tema | Scelta | Alternative scartate |
|---|---|---|
| Storico | **Ibrido**: snapshot reali da oggi in avanti + ricostruzione iniziale derivata dalle transazioni | Solo ricostruzione (falsa sui conti manuali, impossibile per investimenti); solo snapshot (grafico vuoto per mesi) |
| Cadenza snapshot | **Giornaliera**, grafico a granularità adattiva | Mensile (1M/3M con 1-3 punti, inutile) |
| Combinazione | **Ricostruzione materializzata una tantum** in tabella + cron giornaliero dedicato | Ricostruzione calcolata a ogni richiesta (merge complesso, numeri passati instabili); snapshot scritto alla prima apertura del giorno (buchi, race condition) |
| Contenuto home | **Grafico + contesto essenziale**: composizione per classe di asset + card "Questo mese" | Solo grafico nudo; contesto + ultimi movimenti (duplica Transazioni) |

## 1. Dati

### Tabella `net_worth_snapshots`

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK | `defaultRandom()` |
| `userId` | text, FK `auth_user.id` | `onDelete: cascade` |
| `date` | date | giorno di riferimento |
| `assetClass` | text | valori validati da costante TS `ASSET_CLASSES`; oggi solo `"liquidita"` |
| `amount` | numeric(14,2) | può essere negativo (debiti futuri) |
| `source` | text | `"snapshot"` (reale) o `"derivato"` (ricostruito) |
| `createdAt` / `updatedAt` | timestamptz | |

- Vincolo unique `(userId, date, assetClass)`; indice `(userId, date)`.
- `assetClass` e `source` sono `text` + costanti TS, **non** enum Postgres: aggiungere classi future (`investimenti`, `pensione`, `debiti`) non richiede migrazioni. Stesso criterio già adottato per `categories.color`/`icon`.
- Le righe sono **totali per classe**, non per singolo conto: eliminare un conto non riscrive lo storico.
- Precedenza: una riga `snapshot` sovrascrive sempre una `derivato` dello stesso giorno/classe; una `derivato` non sovrascrive mai niente.

### Snapshot giornaliero

- Nuovo scheduler `startNetWorthScheduler()` (cron alle 23:50, orario del server), registrato in `instrumentation.ts` accanto a `startGoCardlessScheduler()` ma indipendente da esso. Stesso guard "no-op se già avviato" del modulo GoCardless.
- Per ogni utente con almeno un conto: se l'utente non ha ancora snapshot, esegue prima la ricostruzione (vedi sotto); poi scrive `liquidita = Σ accounts.balance` con upsert idempotente `source = "snapshot"`.
- Un errore su un utente viene loggato e non blocca gli altri (stesso pattern di `runDueSyncs`).
- Giorni saltati (server fermo) non vengono recuperati: il lettore ripete l'ultimo valore noto.

### Ricostruzione una tantum

Scatta quando l'utente non ha **alcuna** riga in `net_worth_snapshots`, da due punti: il cron giornaliero e la prima chiamata a `GET /api/net-worth/snapshots` (così un utente nuovo vede lo storico subito). Scrive con `onConflictDoNothing`, quindi due esecuzioni concorrenti non producono duplicati né sovrascritture.

Per ogni giorno `G` dal giorno del primo movimento di un conto Auto fino a **ieri** incluso, limitato agli ultimi **24 mesi**:

```
liquidità(G) = Σ saldi attuali dei conti Auto
             − Σ amount dei movimenti dei conti Auto con date > G
             + Σ saldi attuali dei conti manuali
```

- Si usa `amount` **pieno**, non `effectiveAmount`: "Dividi" modifica cosa conta come spesa, non la cassa uscita dal conto.
- I conti manuali restano costanti al saldo attuale su tutto lo storico ricostruito.
- Se non esistono movimenti Auto non viene scritta alcuna riga derivata.

**Limiti accettati consapevolmente**: storico piatto per i conti manuali; movimenti più vecchi importati dopo la ricostruzione non la aggiornano (nessuna rigenerazione, fuori scope).

## 2. Calcolo e API

Pattern invariato rispetto a Cash flow: API sottili che restituiscono righe grezze, calcolo in funzioni pure lato client.

### `lib/calc/net-worth.ts` (funzioni pure, testate)

- `type NetWorthPeriod = "1mese" | "3mesi" | "1anno" | "max"`.
- `deriveLiquidityHistory(accounts, transactions, today)` → righe giornaliere derivate secondo la formula della sezione 1 (solo conti Auto nella sottrazione, massimo 24 mesi, fino a ieri).
- `getNetWorthPeriodRange(period, today)` → intervallo date; `max` parte dalla prima data disponibile negli snapshot.
- `buildNetWorthSeries(snapshots, todayTotal, period, today)`:
  - somma le classi di asset per giorno;
  - riempie i giorni mancanti ripetendo l'ultimo valore noto (nessun punto prima del primo valore disponibile);
  - l'ultimo punto è `todayTotal`, calcolato dai saldi correnti;
  - granularità: un punto al giorno per `1mese`/`3mesi`; per `1anno`/`max` il valore dell'ultimo giorno di ogni mese (il mese in corso usa il valore di oggi);
  - ogni punto riporta se è derivato (`isEstimated`), per il tooltip.
- `computeNetWorthChange(series)` → `{ start, end, delta, deltaPct }`, `deltaPct = null` quando `start === 0` o la serie ha meno di 2 punti.

Il modulo di scrittura su DB (ricostruzione + snapshot) sta in un file server separato, `lib/net-worth/snapshots.ts` (scheduler in `lib/net-worth/scheduler.ts`), e usa `deriveLiquidityHistory`; non contiene logica di calcolo propria.

### `GET /api/net-worth/snapshots?from&to`

- Autenticazione come le altre route (`auth.api.getSession`), 401 senza sessione; `from`/`to` in formato `YYYY-MM-DD` obbligatori, 400 altrimenti.
- Se l'utente non ha righe, esegue la ricostruzione una tantum prima di leggere.
- Restituisce solo le righe dell'utente autenticato nell'intervallo.
- Hook client `useNetWorthSnapshotsQuery(from, to)` in `lib/queries/net-worth.ts`.

### Riuso esistente

- Totale di oggi: `computeAccountsKpi(accounts).totalLiquidity` sui conti di `useAccountsQuery` → il grafico si aggiorna appena cambia un saldo, senza invalidazioni dedicate.
- "Questo mese": `computeMonthlySeries` di `lib/calc/cashflow.ts` sulle transazioni del mese corrente (`type = "tutte"`); "Messo da parte" = entrate − uscite effettive.

## 3. UI

### Route

- Pagina in `app/(app)/panoramica/page.tsx` (la voce sidebar "Panoramica" punta già a `/panoramica`).
- `app/(app)/page.tsx` diventa un `redirect("/panoramica")`; il segnaposto attuale viene rimosso.
- La pagina orchestra soltanto: nessun calcolo inline.

### Composizione (dall'alto, `max-w-4xl` come Cash flow)

1. **Intestazione**: titolo "Panoramica" + data odierna estesa in italiano.
2. **`NetWorthChartCard`**:
   - totale corrente in `font-heading`, grande;
   - variazione assoluta e percentuale colorata `text-pos`/`text-neg`, con etichetta del periodo ("negli ultimi 3 mesi");
   - selettore periodo 1M / 3M / 1A / Max, **default 3M**;
   - grafico ad area Recharts tramite `components/ui/chart.tsx`, essenziale (niente griglia pesante), colori solo da token tema;
   - tooltip con data e valore; per i punti derivati aggiunge la dicitura "stimato".
3. **`NetWorthCompositionRow`**: una mini-card per ogni classe di asset effettivamente presente — nessun segnaposto "presto". Oggi una sola card "Liquidità · N conti" che porta a `/conti`; le classi future compariranno automaticamente. Scelta confermata dall'utente anche se oggi il valore coincide con il totale.
4. **`MonthSummaryCard`**: "Questo mese" con Entrate, Uscite, Messo da parte; porta a `/cash-flow`.

Componenti in `components/domain/net-worth/` con barrel `index.ts`; tipi delle props esportati; JSDoc di una riga su ogni componente/funzione pubblica.

### Stati

- **Nessun conto**: al posto del grafico un invito ad aggiungere o collegare un conto, con link a `/conti`; niente composizione né "Questo mese" vuoti.
- **Un solo punto** (nessuno storico, nessun movimento Auto): totale grande + nota "L'andamento comparirà nei prossimi giorni", niente grafico e niente variazione.
- **Caricamento**: skeleton con la stessa struttura del contenuto (evita layout shift).
- **Errore**: messaggio + "Riprova", stesso pattern di Cash flow.

## Test

- **Funzioni pure** (`lib/calc/net-worth.test.ts`): ricostruzione (sottrazione solo Auto, manuali costanti, `amount` pieno anche con `excludedAmount` ≠ 0, taglio a 24 mesi, nessuna riga senza movimenti Auto); riempimento dei giorni mancanti; granularità adattiva e mese corrente; ultimo punto = totale di oggi; `deltaPct` nullo.
- **Route** (`app/api/net-worth/snapshots/route.test.ts`): 401 senza sessione; 400 su date non valide; ricostruzione eseguita una sola volta anche con chiamate ripetute; isolamento tra utenti.
- **Scrittura snapshot**: upsert idempotente sullo stesso giorno; `snapshot` sovrascrive `derivato`, `derivato` non sovrascrive `snapshot`.
- **Verifica manuale utente** (nessun browser/Postgres reale nel sandbox agentico): grafico con storico stimato su utente con conti Auto, cambio periodo, tooltip "stimato", aggiornamento del totale dopo modifica di un saldo, stato "nessun conto", redirect da `/`.

## Fuori scope (rimandato consapevolmente)

- Classi di asset `investimenti`, `pensione`, `debiti`: arriveranno con le rispettive schermate; lo schema è già pronto ad accoglierle senza migrazioni.
- Lista "Ultimi movimenti": duplicherebbe Transazioni.
- Donut "Allocazione patrimonio": ha senso solo con almeno 2 classi; da riconsiderare quando arrivano gli Investimenti.
- Rigenerazione manuale dello storico derivato e storico per singolo conto.
- Snapshot scatenati dal sync GoCardless (oltre al cron giornaliero).
