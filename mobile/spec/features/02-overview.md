# Overview (Panoramica)

Status: draft · Source: app/(app)/panoramica/page.tsx, app/(app)/layout.tsx, components/domain/overview/, components/domain/net-worth/, components/domain/start/, components/domain/goals/goals-panoramica-section.tsx, lib/overview/voice.ts, lib/calc/net-worth.ts, lib/calc/month-pace.ts, lib/net-worth/, lib/start/, lib/queries/{net-worth,start,goals}.ts, lib/hooks/use-pension-in-net-worth.ts, app/api/net-worth/snapshots/route.ts, app/api/start/route.ts, app/api/start/demo/route.ts

## Purpose

The Overview is the home screen after sign-in. It greets the user, says in plain words how the current month is going, and shows the net worth over time split by asset class: Liquidità (accounts), Investimenti, Previdenza (pension funds) minus Debiti. Below that it shows where the money sits, how the month is going against the usual pace, upcoming loan instalments, savings goals and an investments summary. New users get the «Primi passi» checklist and can try the app with demo data («Esplora con dati d'esempio»). Demo data is clearly marked, can be reset at any time, and blocks real data until it is reset.

## Entry points & navigation

- Default landing route after sign-in: `/panoramica`. It is the first item in the sidebar and in the mobile bottom nav.
- Outbound links from this screen:
  - composition rows: `/liquidita/conti`, `/investimenti`, `/pensione`, `/debiti`
  - «Il mese di …» section link `Movimenti`: `/liquidita/analisi`
  - «Prossime rate» link `Debiti`: `/debiti`
  - goals link `Tutti`: `/analitiche/obiettivi`. Goal row: `/analitiche/obiettivi/{id}`. First-goal CTA: `/analitiche/obiettivi?nuovo=1&da=panoramica`
  - investments link `Portafoglio`: `/investimenti`
  - checklist steps: `/liquidita/conti?nuovo=1`, `/importazioni`, `/investimenti`, `/debiti`, `/pensione`, `/analitiche?traguardo=1` (IT) or `/liquidita/categorie` (DE)
  - renewal banner (from the Accounts area): `/liquidita/conti?rinnova=panoramica`
- The demo-data banner (`DemoBannerContainer`) is mounted in the app layout. It appears at the top of **every** authenticated screen while demo data is active, not only on the Overview.

## Screens

### Overview screen — layout and loading

- Order from top to bottom:
  1. greeting header (always shown, also while loading)
  2. bank-connection renewal banner (only if there are alerts)
  3. one of: loading skeleton, error, empty-onboarding layout, or the full layout
- Full layout order:
  1. «Primi passi» checklist (if visible)
  2. net worth chart card
  3. then two columns on desktop (one column on phone):
     - left column: «Dove sta il patrimonio» composition, then «Il mese di {mese}»
     - right column: «Prossime rate», goals section, «Investimenti»
- Data loaded in parallel:
  - accounts
  - net-worth snapshots (`from=2000-01-01` to today, `compact=1`)
  - transactions from the start of the month 3 months ago to the end of the current month (all accounts)
  - budgets
  - investments overview (period `1mese`)
  - debts
  - pension (country-gated)
  - bank-connection status
  - start status
  - goals (country-gated)
- Loading: the screen shows a skeleton of three blocks while any of these is loading: accounts, snapshots, month transactions, investments.
- Error: `Impossibile caricare i dati della panoramica.` with retry, only when accounts, snapshots or month transactions fail. Retry refetches accounts, snapshots, transactions, investments, debts and pension.
- These blocks are optional. If one fails, the screen still renders without it:
  - investments (then only liquidity is counted)
  - debts
  - pension
  - connection status
  - start status
  - goals
- Empty-onboarding layout is used when there are no accounts, no investments and no pension value (web #394/#444: one centred column):
  - the «Primi passi» checklist, forced visible, with no close button, and with the sample-data offer beside the next step's action. It is hidden anyway if completed or in demo. While the start status loads, a placeholder block of the checklist's height; if it is unavailable, the EmptyState `Nessun conto ancora` / `Aggiungi un conto per vedere il tuo patrimonio netto.` with primary `Crea un conto` → `/liquidita/conti?nuovo=1`.
  - (The separate «Prima dai un'occhiata» demo section was removed by web #444.)

### Greeting header (OverviewVoice)

- The H1 greeting depends on the local hour:
  - before 12: `Buongiorno`
  - 12 to 17: `Buon pomeriggio`
  - from 18: `Buonasera`
- It is followed by `, {first name}` when the session has a name. The first name is the first word of the user's name, shown only after the client has the session.
- Below: today's date, long format, first letter in capitals (e.g. «Martedì 6 ottobre 2026»). Next to it: the «Novità» (What's new) chip, which belongs to another area.
- Then 1–2 sentences. Bold segments are the figures.
- Month pace sentence (omitted when nothing was spent this month and there is no history — a new user gets no «finora hai speso 0 €» line, web #444; then the sentences block is not rendered at all):
  - no history: `{Mese}: finora hai speso ` **amount** `.`
  - within ±5% of usual (minimum tolerance 1 unit): `{Mese} procede in linea con il solito: ` **amount** ` spesi.`
  - above usual: `{Mese} è partito sopra il solito: ` **amount** ` spesi, ` **`{amount} in più`** ` della tua media a questo punto.`
  - below usual: `{Mese} è partito sotto il solito: ` **amount** ` spesi, ` **`{amount} in meno`** ` della tua media a questo punto.`
- Next-due sentence, only if the next loan instalment is within 14 days or overdue: `La rata {name} {when}: ` **amount** `.`
  - `{when}` is one of: `è scaduta`, `scade oggi`, `scade il {d MMMM}`.
- Amounts in these sentences have no decimals.

### Net worth chart card

- Title `Patrimonio netto`, then a big animated amount: the end value of the shown series, with the decimals muted. It shows the privacy mask when amounts are hidden.
- Change line, only when there is history (2 or more points):
  - arrow, sign `+`/`−`, absolute delta (no decimals), ` (±x%)` if computable, then the period phrase: `nell'ultimo mese` / `negli ultimi 3 mesi` / `nell'ultimo anno` / `dall'inizio`
  - green if 0 or more, red if negative
- With fewer than 2 points: `L'andamento comparirà nei prossimi giorni.` and no chart.
- Period selector (segmented control, label `Periodo del grafico`), placed below the chart:
  - options: `1M` (1mese), `3M` (3mesi), `1A` (1anno), `Max`
  - default: `3M`
  - 1M and 3M give daily points. 1A and Max give one point per month (last day of the month, today included).
  - Max starts at the earliest snapshot date.
  - Changing the period never refetches: all history is loaded once.
  - The period is not persisted; it resets on every visit.
- View toggle `Totale` / `Per classe` (label `Vista del grafico`):
  - shown only with history and more than one asset class
  - default: `Totale`
  - Totale: a single area of the net value. The vertical axis is fitted to 90%–101% of the min/max, so the line fills the height. No axes are shown.
  - Per classe: stacked areas, one per asset class, ordered from the bottom: Liquidità, Investimenti, Previdenza. X-axis labels are shown, grid is dotted. Debiti is never stacked.
- Pension switch: `Includi la previdenza nel totale`.
  - Shown only when a Previdenza class exists in the series.
  - Default on. Persisted per device (key `bb:net-worth-include-pension`), and shared with the sidebar summary.
  - When off:
    - the total and change exclude pension
    - in Per classe, the pension area stays visible in grey/dashed
    - the tooltip total label becomes `Totale senza previdenza`
    - the composition row shows ` · fuori dal totale` and pension gets no share
- Legend (Per classe view only, and only with more than one class):
  - one toggle chip per class, showing colour dot, label and the latest value of that class
  - tapping hides or shows the class. The last visible class can never be hidden: the tap is ignored.
  - with some classes hidden:
    - the headline shows the sum of the visible classes only. Debts are not subtracted, and pension is counted only if included.
    - a line `Totale parziale, nascosto: {labels}` appears
    - a `Mostra tutto` chip appears
  - switching back to Totale clears the hidden classes
- Notes under the legend (Per classe):
  - `Linea scura: patrimonio netto`: shown when a separate net line is drawn, i.e. with debts and a full view, or with pension excluded but visible
  - `Il patrimonio netto è già al netto dei debiti`: shown with debts
  - `Area grigia: previdenza, non inclusa nel totale`
- Tooltip (hover on web):
  - date (d MMMM yyyy), plus ` · stimato` if any value at that date was derived rather than a real snapshot
  - one row per class, top-down; Debiti appears as `Debiti (già sottratti)`
  - total row (`Totale`, or the special label above)
- Today's point always uses live values:
  - liquidity = sum of account balances
  - investments = today's portfolio value
  - pension = latest fund snapshot on or before today
  - debts = −total residual debt
- Past points come from snapshots. Each class repeats its last known value on days with no row.

### «Dove sta il patrimonio» (composition)

- Rows only for the classes that exist:
  - Liquidità: `1 conto` / `{n} conti`, sum of balances → `/liquidita/conti`
  - Investimenti: `1 posizione` / `{n} posizioni`, value, plus a market highlight `+/−amount (±x%) dal mercato` → `/investimenti`
  - Previdenza: `1 fondo` / `{n} fondi` → `/pensione`
  - Debiti: shown as a negative amount, `1 debito` / `{n} debiti` → `/debiti`
- Each asset row shows ` · {pct}% del totale` when there are 2 or more asset classes.
- Shares are computed only on positive assets. Excluded pension and debts get no share.
- Donut chart: shown when there are 2 or more asset classes.
  - The centre shows `{pct}% investito` by default.
  - Hovering or focusing a row or slice highlights it, and the centre then shows label, amount and `{pct}% del totale`.
  - Tapping a slice locks or unlocks the highlight.
- Without a donut, when both liquidity and investments exist, the sentence is:
  - `Il {pct}% è investito, il resto è liquidità.`, or
  - `Per ora è tutto liquidità.`
- Returns nothing when there are no items.

### «Il mese di {mese}» (month pace)

- Heading with link `Movimenti` → `/liquidita/analisi`.
- Line chart of cumulative actual spending per day:
  - solid line: this month up to today, with a dot and label at today's value
  - dashed line `di solito`: the average cumulative curve of the previous 3 months that have spending, with the end-of-month value labelled
  - x-axis ticks: 1, mid-month, last day
- Below:
  - `Entrate ricevute`: income so far this month
  - if budgets exist, `Budget`:
    - text `restano {x}` or `sforato di {x}`
    - progress bar of spending in budgeted categories against total monthly budget, capped at 100%, red when over
- Spending excludes the excluded share of split transactions.

### «Prossime rate» (upcoming dues)

- Hidden when there are no dues.
- Up to 3 next instalments. Each shows: date badge (day, short month), loan name, `Scaduta` in red if overdue, amount.
- Link `Debiti` → `/debiti`.
- Footnote: `Residuo dei debiti: {total}`, plus `, ultima rata il {date}` when a debt-free date is known.

### Goals section (see 12-goals)

- Shown only where goals are available (not DE) and once the goals data has loaded.
- With no goals: an invite (not shown while the «Primi passi» checklist is on screen, web #444).
  - Title `Novità: obiettivi di risparmio`
  - Body: `Dai un nome ai tuoi risparmi: un viaggio, la casa, un fondo per gli imprevisti. Scegli da quali conti o investimenti arrivano i soldi e vedi quando ci arrivi e cosa cambia per il giorno in cui smetti di lavorare.`
  - Button `Crea il primo obiettivo` → `/analitiche/obiettivi?nuovo=1&da=panoramica`
  - The close button (`Non ora`) hides the invite. The choice is persisted per device (key `bb-goals-invite-dismissed`).
- With goals: `I tuoi obiettivi`, link `Tutti`, and up to 3 open goals as compact rows.
  - Sorted by months-to-go ascending (no ETA counts as last), then by progress descending.
  - The section is hidden if every goal is achieved.

### «Investimenti» pulse

- Shown only if the user has investment transactions.
- Shows:
  - the market gain or loss with sign, and `{±x,x}% sul versato`, or `dal mercato` if the invested amount is 0
  - a bar of invested amount versus market gain
  - `{n} posizioni · versati {paid}` and the total value
- Link `Portafoglio` → `/investimenti`.

### «Primi passi» checklist (reworked by web #444 and #452)

- Steps, each auto-ticked from the user's real data (sample accounts never count); which ones are asked depends on what the user said they want to keep an eye on (`focus`, chosen at the end of onboarding — 01-auth-onboarding — or with `Cambia cosa vuoi tenere sotto controllo`):

  | id | Title | Description | CTA → target | Done text | Done when |
  |---|---|---|---|---|---|
  | conto | `Aggiungi il tuo conto` | `Collega la banca oppure crealo a mano: bastano il nome e il saldo di oggi.` | `Aggiungi un conto` → `/liquidita/conti?nuovo=1` | `Conto aggiunto` | a non-demo account exists |
  | import | `Importa i movimenti` | `Carica il CSV o l'estratto conto della tua banca, oppure collega la banca.` | `Importa un file` → `/importazioni` | `Movimenti aggiunti` | any transaction exists on a non-demo account (any source: CSV imports, bank sync, typed by hand; web #452) |
  | investimento | `Aggiungi un investimento` | `Registra un acquisto o importa il rendiconto del tuo broker.` | `Vai agli investimenti` → `/investimenti` | `Primo investimento registrato` | any investment transaction exists |
  | debito | `Aggiungi il mutuo o un prestito` | `Importo, tasso e durata: calcoliamo il piano rate, quanto paghi di interessi e quando finisci.` | `Aggiungi un finanziamento` → `/debiti` | `Finanziamento aggiunto` | any debt exists |
  | pensione | `Aggiungi il fondo pensione` | `Bastano i contributi versati e il valore di oggi, dall'area clienti del fondo.` | `Aggiungi il fondo` → `/pensione` | `Fondo pensione aggiunto` | any pension fund exists |
  | obiettivo | `Fissa il tuo traguardo` | `Dicci quanto ti serve in un anno: calcoliamo il patrimonio che ti basta per vivere di rendita e quando ci arrivi.` | `Fissa il traguardo` → `/analitiche?traguardo=1` | `Traguardo fissato` | any budget or goal exists, or analytics assumptions are non-empty |

- Steps asked (`stepIds` from the server, fixed order): with no focus, `conto`, `import`, `investimento`, `obiettivo`; with a focus, `conto`, the step of each chosen focus (`spese` → import, `investimenti` → investimento, `debiti` → debito, `pensione` → pensione) and `obiettivo`. `pensione` is never asked where the pension section is hidden (DE).
- Country gating: when `retirement` is off (DE), step `obiettivo` becomes title `Imposta un budget`, description `Imposta un budget per categoria.`, CTA `Vai alle categorie` → `/liquidita/categorie`, done text `Budget impostato`.
- Header `Primi passi`, status line `{n} su {m} fatti` (m = steps asked, minus skipped steps not done), close button `Nascondi i primi passi` (X; `PATCH /api/start {dismissed:true}`, no confirmation; not in the empty-onboarding layout).
- **Next step block** (filled card): the first step neither done nor skipped. Above it, once per visit to Panoramica, the done texts of the steps just completed with a check (e.g. `✓ Conto aggiunto`). Label `Prossimo passo`, the step title in the display face, its description, then its CTA as the main (sun) button; in the empty-onboarding layout `Prima prova con dati d'esempio` beside it (`Preparo l'esempio…` while busy; server errors inline under the buttons); `Non mi serve` beside it for every step but `conto` (`PATCH /api/start {step, skipped:true}`, web #452).
- **The other steps** as a list: check circle (filled when done), title (struck through when done; `· Saltato` when skipped), and on the right the step's CTA (not done), nothing (done) or `Rimetti` (skipped; `PATCH /api/start {step, skipped:false}`).
- `Cambia cosa vuoi tenere sotto controllo` (text button under the list) opens the focus sheet: title `Cosa vuoi tenere sotto controllo?`, text `I primi passi cambiano con la tua scelta. Senza nessuna scelta restano i quattro di partenza.`, the four answers as toggle tiles (01-auth-onboarding), `Annulla` / `Salva` (`Salvataggio in corso…`; `PATCH /api/start {focus}`); the steps asked change right away.
- Completion: all steps asked done **or skipped** (web #452). When the API first sees it, it records the time and returns `justCompleted: true` once.
- Refresh: the status is re-read when the Overview becomes active again, after any write that can tick a step (imports, syncs, sample data), and every 15 s while incomplete, not dismissed and the app is in the foreground (web #452).
- A step that becomes done elsewhere in the app is announced by a toast (SHELL-060); in Panoramica the next-step block says it instead.

### Demo data: offer, banner, lockout

- Offer (empty-onboarding layout only): the `Prima prova con dati d'esempio` button beside the next step's action (web #444; the former «Prima dai un'occhiata» section with `Esplora con dati d'esempio` was removed). While busy it reads `Preparo l'esempio…`. Errors from the server show inline under the buttons.
- Start: `POST /api/start/demo` creates:
  - 2 demo accounts, `Conto corrente · demo` and `Risparmi · demo`
  - about 6 months of fixed sample transactions on the user's default categories
  - a derived liquidity history
- The server rejects the start with 409 and a message in these cases:
  - `Hai già dei conti: i dati d'esempio sono per chi parte da zero.` (accounts exist)
  - `I dati d'esempio sono già attivi.`
  - `Completa prima la configurazione iniziale.` (no categories)
- On success all cached data is invalidated and refetched.
- Banner, shown on every screen while demo is active:
  - **`Dati d'esempio.`** `Quello che vedi è inventato. Azzera per aggiungere i tuoi conti e movimenti.`
  - Button `Azzera e inizia`. While busy it reads `Azzero…`.
  - Reset: `DELETE /api/start/demo` removes the demo accounts, their transactions and **all** liquidity snapshots. The web asks for no confirmation. Then all data is refetched.
- Lockout: while demo is active, the server rejects with 409 these actions: creating an account, creating a transaction, starting a bank connection.
  - Response: `{code:"demo_active", error:"Stai esplorando i dati d'esempio: azzerali per aggiungere i tuoi."}`
- While demo is active the checklist is hidden.

### Country gating

- `productCountry === "DE"`:
  - goals are not requested and the goals section is not shown (`isCountryPathAvailable(country, "/analitiche/obiettivi")` is false)
  - the pension query is disabled (`features.pension` false), so there is no Previdenza class, no pension switch and no `/pensione` link
  - checklist step `obiettivo` is replaced as described above, and `pensione` is never asked
- Everything else is identical for IT and DE.

## Requirements

#### Greeting & layout
- **OV-001** The app shall show a greeting based on the device's local hour: `Buongiorno` before 12:00, `Buon pomeriggio` from 12:00 to 17:59, `Buonasera` from 18:00. When the user has a name, the greeting shall be followed by `, {first word of the user's name}`.
- **OV-002** The app shall show today's date in long localized format with a capitalized first letter below the greeting.
- **OV-003** The app shall show a month-pace sentence. It shall compare spending so far with the average of the previous 3 months that have spending, up to the same day of the month, using a ±5% tolerance (minimum 1 currency unit). It shall use one of four variants: no history, in line, above, below. _API: `GET /api/transactions?from=&to=&type=tutte`, `GET /api/budgets`_ (Changed by web #444: with nothing spent and no history the sentence is omitted; computed server-side in `voice`.)
- **OV-004** The app shall add a next-due sentence only when the next loan instalment is overdue or due within 14 days. _API: `GET /api/debts`_
- **OV-005** The app shall show a loading skeleton until accounts, snapshots, month transactions and investments have loaded.
- **OV-006** The app shall show `Impossibile caricare i dati della panoramica.` with a retry action when accounts, snapshots or month transactions fail. Failures of investments, debts, pension, connections, start status or goals shall only hide their own section.
- **OV-007** (changed by web #444) The app shall show the empty-onboarding layout (one column: the checklist with the sample-data offer beside the next step, a placeholder while the start status loads, or the «Nessun conto ancora» empty state) when the user has no accounts, no investments and no pension value.

#### Net worth chart
- **OV-008** The app shall load the whole net-worth history once, from 2000-01-01 to today in compact form, and shall not refetch when the period changes. _API: `GET /api/net-worth/snapshots?from=2000-01-01&to={today}&compact=1`_
- **OV-009** The app shall offer periods `1M`, `3M`, `1A`, `Max`, defaulting to `3M` on each visit. 1M and 3M shall show daily points; 1A and Max shall show one point per month.
- **OV-010** The app shall compute today's point from live values. Liquidity = sum of account balances; investments = current portfolio value; pension = latest fund snapshot on or before today; debts = −total residual. _API: `GET /api/accounts`, `GET /api/investments/overview?period=1mese`, `GET /api/pension`, `GET /api/debts`_
- **OV-011** The app shall carry each asset class's last known value forward on days without a snapshot row, and shall mark a point as `stimato` when any of its values is derived.
- **OV-012** The app shall show the net worth headline with an animated count, the change against the first point of the period (absolute and %, sign-colored) and the period phrase.
- **OV-013** The app shall show `L'andamento comparirà nei prossimi giorni.` and no chart when the series has fewer than 2 points. While imported data is on its way (OV-044) the line reads the refresh message instead.
- **OV-014** The app shall offer a `Totale` / `Per classe` view toggle, defaulting to `Totale`, shown only when there is history and more than one asset class.
- **OV-015** In `Per classe`, the app shall stack asset classes from the bottom (Liquidità, Investimenti, Previdenza). It shall not stack Debiti, and shall draw a separate net line when debts exist or pension is excluded.
- **OV-016** In `Per classe`, the app shall show a legend chip per class with its latest value. Tapping a chip shall hide or show that class, but never the last visible one.
- **OV-017** When classes are hidden, the app shall show as headline the sum of the visible classes (without debts, pension only if included), show `Totale parziale, nascosto: …`, and offer `Mostra tutto`. Switching to `Totale` shall clear hidden classes.
- **OV-018** The app shall show the `Includi la previdenza nel totale` switch when pension exists. It shall default to on and be persisted per device. It shall be shared with the sidebar net-worth summary.
- **OV-019** When pension is excluded, the app shall remove pension from the total and the change, keep its area visible in grey/dashed, and label the total `Totale senza previdenza`.
- **OV-020** The app shall show a per-point detail (date, per-class values top-down with Debiti as `Debiti (già sottratti)`, total).
- **OV-021** The app shall apply the «Nascondi importi» mask to all amounts on the Overview, including the headline.

#### Composition, month, dues, investments
- **OV-022** The app shall list composition rows only for the classes present (Liquidità, Investimenti, Previdenza, Debiti), each linking to its area.
- **OV-023** The app shall compute each asset's share of the total on positive assets only, excluding debts and excluded pension.
- **OV-024** The app shall show a donut with `{pct}% investito` at its centre when at least 2 asset classes exist. Selecting a slice or row shall show that class's amount and share.
- **OV-025** The app shall show the investments row highlight as market gain (`+/−amount (±%) dal mercato`) relative to the invested amount.
- **OV-026** The app shall show the «Il mese di {mese}» section. It shall contain the cumulative spending curve with the dashed usual curve, `Entrate ricevute`, and, if budgets exist, `restano {x}` or `sforato di {x}` with a progress bar.
- **OV-027** The app shall show up to 3 upcoming loan instalments, marking overdue ones `Scaduta`. It shall add the residual-debt footnote, and hide the section when there are no dues. _API: `GET /api/debts`_
- **OV-028** The app shall show the «Investimenti» pulse only when the user has investment transactions.
- **OV-029** The app shall show the bank-connection renewal banner when connections are near expiry, linking to `/liquidita/conti?rinnova=panoramica`. _API: `GET /api/gocardless/connections`_

#### Goals in Overview
- **OV-030** The app shall request goals and show the goals section only where `/analitiche/obiettivi` is available for the product country (not DE). _API: `GET /api/goals`_
- **OV-031** (changed by web #444) With no goals, the app shall show the dismissible «Novità: obiettivi di risparmio» invite, except while the «Primi passi» checklist is shown. Dismissal shall persist per device.
- **OV-032** With goals, the app shall show up to 3 open goals sorted by months-to-go ascending, then progress descending, with a `Tutti` link to the goals list.

#### Primi passi
- **OV-033** (changed by web #444/#452) The app shall show the steps the server asks for (`stepIds`), each ticked automatically from real (non-demo) data; the `import` step is done by any real transaction. _API: `GET /api/start`_
- **OV-034** (changed by web #444/#452) The app shall show `{n} su {m} fatti`, m being the steps asked minus skipped steps not done.
- **OV-035** The app shall hide the checklist when it is dismissed or completed, or while demo data is active. In the empty-onboarding layout it shall show it regardless of dismissal and without a close button.
- **OV-036** The app shall let the user dismiss the checklist with the close button. _API: `PATCH /api/start` body `{dismissed:true}`_
- **OV-037** (changed by web #444) Where the `retirement` feature is off (DE), step `obiettivo` shall read `Imposta un budget` / `Imposta un budget per categoria.` / `Vai alle categorie` → `/liquidita/categorie` / `Budget impostato`.
- **OV-038** (changed by web #452) The app shall refresh the start status every time the Overview becomes active again and every 15 s while the checklist is incomplete, not dismissed and the app is in the foreground.
- **OV-045** (web #444) The app shall show the next step (first neither done nor skipped) alone in a filled block with `Prossimo passo`, title, description and its action as the main button, and the other steps as a list with their actions, struck through when done.
- **OV-046** (web #452) The next step, unless it is `conto`, shall offer `Non mi serve`; skipped steps shall show `· Saltato` with `Rimetti`, and completion shall count skipped steps as settled. _API: `PATCH /api/start` body `{step, skipped}`_
- **OV-047** (web #444) `Cambia cosa vuoi tenere sotto controllo` shall open the focus sheet preselected with the saved focus and save the new answer, changing the steps asked. _API: `PATCH /api/start` body `{focus}`_
- **OV-048** (web #444) Steps done since the last visit to Panoramica shall be acknowledged once above the next step with their done texts.

#### Demo data
- **OV-039** (changed by web #444) The app shall offer `Prima prova con dati d'esempio` beside the next step in the empty-onboarding layout. On success it shall refetch all data. _API: `POST /api/start/demo`_
- **OV-040** The app shall show the server's error message inline when starting demo data fails (409: has data / already active / no categories).
- **OV-041** While demo data is active, the app shall show the demo banner (`Dati d'esempio.` …, `Azzera e inizia`) at the top of every authenticated screen.
- **OV-042** The app shall reset demo data from the banner and then refetch all data. _API: `DELETE /api/start/demo`_
- **OV-043** While demo data is active, the app shall handle the `409 {code:"demo_active"}` response from account creation, transaction creation and bank connection by showing its message. _API: `POST /api/accounts`, `POST /api/transactions`, `POST /api/gocardless/connections`_

#### Chart refresh
- **OV-044** (web #447) While a file import or bank sync runs, the net-worth chart shall show `Sto aggiungendo i nuovi movimenti: il grafico si aggiorna da solo appena finisco.` and, from its end until the history has been reloaded, `Aggiorno il grafico con i nuovi movimenti…`, dimming the old curve; the history follows imported files on every past day they touch (server-side, cash rows store their ledger part). _API: `GET /api/sync-jobs`, `GET /api/personal-imports`, `GET /api/overview`_

## Mobile adaptation notes

- **Proposal — needs product sign-off:** Chart detail. Replace the hover tooltip with press-and-hold scrubbing: while the finger is down, a vertical cursor follows it. A detail card pinned above the chart shows the OV-020 content, and the headline amount and change temporarily show the scrubbed point. Releasing restores the period values. Light haptic tick on each data point.
- **Proposal — needs product sign-off:** Composition donut. Tap toggles the locked highlight; there is no hover state. Rows act as both highlight and navigation: the first tap on the chevron area navigates, a tap on the donut slice highlights.
- **Proposal — needs product sign-off:** Two-column desktop grid. On phone, show a single column in this order: checklist, chart card, composition, month, upcoming dues, goals, investments. This matches the current narrow-web stacking.
- **Proposal — needs product sign-off:** Demo reset. Keep the one-tap reset as on the web (no confirmation), but show a non-blocking snackbar `Dati d'esempio azzerati` afterwards. Alternatively add a bottom-sheet confirmation; this needs product sign-off because web has none.
- **Proposal — needs product sign-off:** Persisted per-device prefs (`bb:net-worth-include-pension`, `bb-goals-invite-dismissed`). Store them in native key-value storage (UserDefaults / DataStore) with the same keys and defaults. They are not synced to the account.
- **Proposal — needs product sign-off:** Greeting animation (blur-in word by word). Use a short fade-in. Respect the OS reduce-motion setting.
- **Proposal — needs product sign-off:** Pull-to-refresh on the Overview triggers the same refetch set as the retry action (OV-006), plus start status and goals.

## Open questions

1. The composition sentence `Il {pct}% è investito, il resto è liquidità.` / `Per ora è tutto liquidità.` is not passed through `t()`. Also untranslated: the legend chip labels, the hidden-class labels and the tooltip strings `stimato`, `Totale`, `Debiti (già sottratti)`. In en/de these appear in Italian. Should mobile translate them? This needs catalog keys.
2. The checklist step «obiettivo» counts as done when any budget exists, even in IT where its CTA is about the FIRE target. Is this intended?
3. There is no UI to reopen a dismissed checklist (`PATCH {dismissed:false}` exists but is unused). Still true after web #444/#452.
4. Clearing demo deletes **all** `liquidita` snapshots for the user, not only demo-derived ones. This is safe today only because real accounts are blocked during demo. Confirm that mobile must also never allow real data during demo.
5. The demo lockout is enforced only on account creation, transaction creation and bank connection. Investments, debts, pension and imports are not blocked (CLAUDE.md lists «guardia su import personalizzati» as postponed). The mobile UX should be told which actions can return 409.
6. The snapshots endpoint does derived backfills on each GET and returns potentially hundreds of KB. Mobile should cache it (web uses a 2-minute stale time). Is a lighter mobile endpoint needed?
7. The greeting uses the device clock and time zone, while server "today" (`todayIso`) may differ around midnight. Should the day boundary be the device's time or Europe/Rome?
8. The month-pace "usual" curve depends on 3 previous months of transactions fetched client-side. Mobile needs the same client-side calculation (lib/calc/month-pace) or a server endpoint.
