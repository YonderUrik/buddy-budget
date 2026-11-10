# Securities & watchlist (Titoli)
Status: draft · Source: `app/(app)/investimenti/titoli/page.tsx`, `app/(app)/investimenti/titoli/[id]/page.tsx`, `app/(app)/investimenti/page.tsx` (search + «Seguiti»), `app/(app)/investimenti/layout.tsx`, `components/domain/investments/titles/*`, `components/domain/investments/risk/risk-level-meter.tsx`, `components/domain/investments/instrument-picker.tsx`, `instrument-search-results.tsx`, `instrument-manual-form.tsx`, `instrument-icon.tsx`, `components/domain/investments/taxes/instrument-settings-dialog.tsx`, `lib/queries/titles.ts`, `lib/queries/investments.ts` (instrument hooks), `lib/investments/title-view.ts`, `title-stats.ts`, `title-fundamentals.ts`, `titles-list.ts`, `alerts.ts`, `alerts-run.ts`, `instruments.ts`, `search-results.ts`, `lib/market-data/fundamentals.ts`, `lib/validation/investments.ts`, `app/api/instruments/**`, `app/api/investments/titles/route.ts`, `docs/decisioni/2026-10-11-scheda-titolo-e-indicatori.md`, `2026-10-11-isolamento-ricerca-strumenti.md`, `2026-10-11-strumenti-comuni-per-utente.md`, `2026-10-11-quanto-rischia-scala-a-fasce.md`

## Purpose
Let the user look up any instrument (ETF, stock, fund, bond/BTP, ETC, crypto) by name, ticker or ISIN, open a single **security page** ("scheda titolo") with price, key numbers, a chart with their own purchases, risk, fundamentals (stocks) or composition and costs (ETF/funds), follow instruments without owning them (watchlist, «Seguiti»), and set **price alerts** that send an email once when the daily close crosses a level. Everything is information, never advice: no "cheap/expensive" judgements, no target prices or analyst recommendations (decision 2026-10-11). The rest of Investimenti (portfolio, register operation, imports, performance, diversification, dividends, taxes, operations) is in **07-investments**.

The instrument catalogue is shared between users for prices, dividends and profiles, but every user-specific choice (tax rate, harmonised flag, coupons, watchlist, alerts, manual prices, sector/area corrections) is stored per user, and search only lists instruments linked to the user (decisions 2026-10-11 "isolamento ricerca" and "strumenti comuni per utente").

Available in both IT and DE. Country gating in this area: only the tax-related bits (see §6 and INS settings).

## Entry points & navigation
- There is **no standalone securities list screen**: `/investimenti/titoli` redirects to `/investimenti` (old links/bookmarks). Securities are opened from:
  - Portafoglio tab (`/investimenti`, see 07): the `Cerca un titolo` search button in the positions section header; tapping a position row; the «Seguiti» watchlist section.
  - Sidebar insights module (positions and watchlist rows link to `/investimenti/titoli/{id}`; see 00-app-shell-navigation).
  - Price-alert email CTA `Guarda il titolo` → `{appUrl}/investimenti/titoli/{instrumentId}` (deep link).
- Security page route: `/investimenti/titoli/{instrumentId}`. It hides the Investimenti header, tabs and broker selector; it has its own header with BackLink `‹ Portafoglio` → `/investimenti`. The shared Register-operation dialog of the Investimenti layout stays available (button `Registra`).

## Screens

> **Phone layout (Phase 4R, web 0.81.0).** Security page header: badge 32 + name in the display face, then type · ISIN ·
> currency and «Posseduto»; «Segui» (ghost sm) and «Registra» (sm) under it; price as `MoneyHero`; key facts on the page
> under a thin top border (no card); `Andamento` uses the shared `PeriodSelector` and an inset chart with dates; «In
> numeri» in two columns; composition and sector rows on one line (name 110 · bar · share).

### 1. Instrument search (picker) — `Cerca un titolo`
Same picker component is used by the Register-operation form (07); here selecting a result navigates to the security page.
- Trigger shows placeholder `Cerca un titolo`; opens a popover (bottom sheet on phone) with a search field (placeholder `VWCE, Apple, IE00BK5BQT80…`, a11y `Cerca strumento`).
- **Before typing** (<2 chars): if the user holds instruments today (quantity > 0; web #445) they are listed as `I tuoi strumenti` followed by `Oppure cercane un altro: scrivi almeno 2 caratteri.`; otherwise `Scrivi almeno 2 caratteri.`
- **Search** (≥2 chars, debounce 300 ms, cached 60 s): `GET /api/instruments/search?q=`. While first fetching: `Ricerca…`.
  - `Già aggiunti`: known instruments linked to the user (created by them, with their operations, watched, with their alert or settings) matching ISIN exactly or name substring; max 8; the user's portfolio instruments ranked first. Row: icon/logo, name, `{currency} · {ISIN}`, type tag. Tap → open.
  - Market results grouped by type in this order: ETF, Azioni, Fondi, Obbligazioni, ETC, Crypto (`SEARCH_TYPE_ORDER`), each group header `{Tipo} ({n})` with type colour. Row: name + `{symbol} · {exchange}` (crypto: `{SYMBOL} · in {valuta}`). With >1 group, filter chips `Tutti` + one per type (single select).
  - Crypto filtering: CoinGecko results are kept only when symbol/name equals the query (or starts with it when Yahoo returned nothing); max 5. Yahoo crypto rows are dropped when CoinGecko found the coin.
  - If the query is a valid ISIN and nothing is found, the server asks OpenFIGI for listings confirmed by Yahoo.
  - Tapping a market result **creates/reuses** the instrument (`POST /api/instruments`, source `yahoo` with the typed ISIN attached, or `coingecko` with the user's base currency) and then opens its page. Results are disabled while creating.
  - Source down: `La fonte di ETF, azioni e fondi non risponde in questo momento: riprova tra qualche minuto, oppure aggiungilo qui sotto.` No results: `Nessun risultato dalle fonti di mercato.`
  - **`Non lo trovi?`** mini form (always shown while searching): `Nome` (placeholder `Nome (es. BTP Valore 2029)`, required), type select (default `obbligazione` if typed ISIN starts with `IT`, else `fondo`), currency (3 uppercase letters, default base currency). A bond with a valid ISIN is created as "solo ISIN" (`I prezzi arriveranno da Borsa Italiana (ISIN {0}).`); everything else becomes a private manual instrument (`Strumento visibile solo a te: i prezzi li inserisci a mano.`). Button `Aggiungi strumento` / `Aggiunta…`. Errors from server shown inline.
- Server rules (`createInstrumentSchema`): yahoo symbol 1–40, name 1–200, type ∈ instrument types, optional valid ISIN; coingecko id 1–100 + currency; isin source with ISIN, name, type, currency. On create the server starts a 30-day price backfill in background (`?history=deferred` skips it). 201 when created, 200 when reused.

### 2. Watchlist — «Seguiti» section (in Portafoglio)
- Shown under the positions list on `/investimenti` only when the user follows at least one instrument **not currently held**; hidden on error or when empty (no empty state). Not visible while the Portafoglio shows its own empty state (user with no operations, see 07).
- Title `Seguiti`, description `Titoli che osservi senza possederli. Aprine uno per il grafico e gli avvisi di prezzo.`
- Data: `GET /api/investments/titles` → items (watched ∪ held) sorted held first, then name. Each row: icon/logo, name, type label, badge `Seguito`, bell + `{n} avviso|avvisi` (active alerts), destructive badge `Avviso scattato` / `{0} avvisi scattati`, 35-day sparkline (hidden on phone), last close (instrument currency, 4 decimals below 10) or `Nessun prezzo` (only provider closes are used, never manual prices), day change % coloured. Tap → security page.
- The sidebar "watchlist" module uses the same concept (00-app-shell-navigation).

### 3. Security page (`/investimenti/titoli/{id}`)
One request `GET /api/instruments/{id}/analysis?period={1M|3M|6M|1A|5A|Max}` (default `1A`) returns everything. While the server is still downloading price history (`backfilling: true`) the request is **re-polled every 2.5 s**. Changing chart period refetches the whole payload.
- Loading: three skeleton blocks. Error: `Impossibile caricare il titolo.` (or server message, e.g. `Strumento non trovato` 404, `Periodo non valido` 400) with retry.
- Opening the page also makes the server ensure price history (≥1 year; 5 years for stocks/ETF/funds), profiles and dividends in background.

Content order (phone = single column in this order; desktop = header, key facts, then 3/5 + 2/5 columns, then detail sections):
1. Header
2. Key facts row ("in breve")
3. Chart `Andamento`
4. `Prezzi automatici` (manual instruments with ISIN only)
5. `In numeri`
6. `La tua posizione` (if held)
7. `Quanto rischia`
8. `Ce l'hai già dentro` (stocks contained in held funds)
9. `Avvisi di prezzo`
10. Type-specific detail sections (§3.10)
11. `Commento` (only if available)

#### 3.1 Header
- BackLink `‹ Portafoglio`; instrument icon/logo (logo from `GET /api/instruments/{id}/logo`, 404 → local type icon); name; line with type (`ETF`, `Azione`, `Obbligazione / BTP`, …), ISIN (if any), currency, badge `Posseduto` when held.
- Actions: `Segui` / `Non seguire più` (toggle, eye icon, disabled while pending; **no confirmation**); `Registra` opens the Register-operation dialog prefilled with this instrument (07).
- Big last close (instrument currency, 2 decimals, 4 when price <10, animated, muted decimals), then `{±x%} nel giorno · {±y%} in un anno · chiusura del {data}` (each part omitted if not computable; negative red / positive green). Whole price block hidden when there are no closes.

#### 3.2 Key facts row (up to 6, missing ones skipped)
- **Stock** (`azione`): `Capitalizzazione` ({compact} {currency}); `P/E` (app-computed TTM, fallback Yahoo trailing P/E; note `utili ultimi 12 mesi`); `Ricavi per azione` (note `ultimi 12 mesi`); `Dividendo` yield % (only if >0; note `{x} {cur} in 12 mesi`).
- **ETF / fund**: `Costo annuo (TER)` (note `{TER×10.000} {currency} ogni 10.000`); `Patrimonio`; `Categoria`; `Rendimento da dividendo` (if >0).
- **Other types**: `1 anno`, `Da inizio anno` returns.
- Then for all: `Volatilità` (0 decimals, note `ultimo anno`) and `Dal massimo` (% from 52-week high or `sui massimi` when within 0.5%, note `52 settimane`). Truncated to 6. Phone: 2 columns.

#### 3.3 Chart `Andamento`
- Segmented period control `1M` `3M` `6M` `1A` `5A` `Max` (default `1A`; labels not translated). Area chart of closes (max 240 points, downsampled), green if period ends ≥ start, else red. Tooltip: long date + price.
- If the user holds it: purchase markers (dot on the first chart point on/after each purchase date; purchases outside the period skipped) and a dashed line at the user's average price; legend `I tuoi acquisti`, `Il tuo prezzo medio ({prezzo})`.
- Fewer than 2 points: `Sto scaricando lo storico dei prezzi…` (while backfilling) or `Non ci sono ancora abbastanza prezzi per il grafico.` While backfilling with data: `Sto ancora scaricando lo storico: il grafico si completa da solo.`
- Closes = provider closes, with the user's own manual prices overriding on the same date.

#### 3.4 `Prezzi automatici` (link a quotation)
- Shown only for a manual-price instrument with an ISIN created by a user (private). Text `Questo titolo ha solo i prezzi del rendiconto ({ISIN}). Collegalo a una quotazione in {cur} per avere prezzi aggiornati ogni giorno, rendimenti, settori e sovrapposizioni.`
- `Cerca la quotazione` → `GET /api/instruments/{id}/quotation` (on demand, cached 5 min): `Cerco le quotazioni di {ISIN}…`; results list (symbol, exchange or `Borsa non indicata` · currency) each with `Collega` → `POST /api/instruments/{id}/quotation {yahooSymbol}` (1–40). After linking, prices are backfilled from the first operation date and the whole Investimenti data is refreshed. Empty: `Non ho trovato una quotazione in {cur} per questo ISIN: restano i prezzi del rendiconto.` Sources down: `Le fonti non rispondono in questo momento. Riprova tra poco.` 409 errors: `Questo strumento non si può collegare a una quotazione` / `Questo strumento ha già i prezzi automatici o non ha un ISIN`.

#### 3.5 `In numeri`
- Returns for `1 mese`, `3 mesi`, `6 mesi`, `1 anno`, `Da inizio anno` (only those the history reaches; start close tolerance 10 days; YTD from last close of previous year). Empty: `Lo storico è ancora troppo corto per calcolare le variazioni.`
- `Forbice dell'ultimo anno` + `· {x%} sotto il massimo` or `· sui massimi`; range bar with marker at last close between `Min {prezzo}` and `Max {prezzo}` (52 weeks).

#### 3.6 `La tua posizione` (only when quantity > 0)
- `Valore` (quantity × last close, ×1/100 for bonds quoted in % of nominal), `Guadagno sul prezzo medio` (`+/−{amount} · {±%}`, coloured), `Proventi incassati (lordi)` (only if >0), `Quote` (up to 6 decimals), `Prezzo medio`. All in the instrument currency.
- Footnote: IT `Valori nella valuta del titolo ({cur}), senza cambio né tasse. Il guadagno completo è nelle schede Portafoglio e Tasse.`; DE (taxes feature off) `Valori nella valuta del titolo ({cur}), senza cambio né stime fiscali.`

#### 3.7 `Quanto rischia` (description `Nell'ultimo anno`; hidden without volatility, i.e. <20 observations)
- Risk level from 1-year annualised volatility: `Basso` <8%, `Medio` <15%, `Alto` <25%, `Molto alto` ≥25%. Four-band green→red scale, marker positioned proportionally (scale max 35%), level word in level colour, band names under the scale (colour never the only signal), `±{vol}% all’anno` with info hint `Volatilità annua: di norma il prezzo si muove di circa questa percentuale in un anno, in su o in giù (due anni su tre).`, level sentence.
- `Calo peggiore dal massimo nell'ultimo anno: {−x%}` or `nessuno` (within 0.5%).

#### 3.8 `Ce l'hai già dentro` (stocks only; hidden if none)
- Held funds whose top holdings contain this stock: fund name + `{x%} del fondo`. Footnote `Dai primi titoli dei fondi che possiedi (fonte Yahoo Finance).`

#### 3.9 `Avvisi di prezzo`
- List (oldest first) of the user's alerts on this instrument, active and triggered: bell icon (ringing if triggered), `Sale sopra {prezzo}` / `Scende sotto {prezzo}`, subline `In attesa: controllo ogni sera dopo la chiusura` or `Scattato il {data} con la chiusura a {prezzo}`, delete icon (`Elimina avviso`) → **deleted immediately, no confirmation** (`DELETE /api/instruments/{id}/alerts/{alertId}`).
- Empty: `Nessun avviso. Ti scrivo per email quando la chiusura raggiunge il livello che scegli.`; for non-automatic-price instruments: `Gli avvisi funzionano solo per i titoli con prezzi automatici.` and no form.
- Create form: segmented `Sale sopra` | `Scende sotto` (default `Sale sopra`), field `Livello ({cur})` (decimal keypad, placeholder `Ultima chiusura {prezzo}` or `Prezzo`; comma or dot accepted; must be >0; invalid input flagged), button `Crea avviso` (disabled when invalid or pending); field cleared on success; server error shown inline.
- Server rules (`POST /api/instruments/{id}/alerts`): only `priceMode = auto` (`Gli avvisi funzionano solo per gli strumenti con prezzi automatici`); direction ∈ {sopra, sotto}; targetPrice >0 ≤1e12; max **10 active alerts per instrument** (`Al massimo 10 avvisi attivi per titolo`); rejected when the latest close is already at/over the level (`L'ultima chiusura è già oltre questo livello`).
- Evaluation: nightly cron after price update. Triggers when close ≥ level (sopra) or ≤ level (sotto); status `attivo → scattato` once (never repeats); one email per alert (subject `Avviso di prezzo: {nome} {sale sopra|scende sotto} {livello}`, body with last close and date, CTA `Guarda il titolo`, footnote that it does not repeat and is not a recommendation). If email is not configured or fails, the alert still triggers and is visible in-app. Alerts are not affected by unfollowing.

#### 3.10 Detail sections by type
Footer source note: stocks with statements `Bilanci, numeri chiave e date di stacco da Yahoo Finance (non ufficiali), aggiornati una volta al giorno; multipli, valori per azione e confronti con il passato calcolati dall'app. Sono informazioni, non consigli di acquisto o vendita.`; ETF/funds `Composizione, TER e multipli del paniere da Yahoo Finance (non ufficiali), aggiornati una volta al giorno; rendimenti, costi e sovrapposizioni calcolati dall'app. Sono informazioni, non consigli di acquisto o vendita.`

Every computed indicator (§a–d) shows: label with a `?` button (a11y `Come si calcola: {label}`) opening a popover (bottom sheet on phone) with the formula in words, **the division with the real numbers** (`{numeratore} ÷ {denominatore} = {valore}`), and source `Calcolato dall'app sui bilanci pubblicati da Yahoo Finance (non ufficiali).`; big value; for valuation multiples a **historical range bar** (min–max of past fiscal years at year-end price, tick at average, dot at today; `min {x}` / `max {y}`; only with ≥3 years); one-sentence hint. Opening a popover tracks `title_indicator_opened`.

**Stock with statements** (Yahoo annual statements + TTM, cached 24 h):
- a. `Quanto costa rispetto a quello che produce` — `Multipli calcolati con l'ultima chiusura e i bilanci degli ultimi 12 mesi.` Indicators (in order, only those computable): `P/E (prezzo / utili)`, `P/S (prezzo / ricavi)`, `P/B (prezzo / patrimonio)`, `P/FCF (prezzo / cassa libera)`, `EV / EBITDA`, `Rendimento degli utili` (no range). Note `La barra va dal minimo al massimo degli esercizi passati, con la tacca sulla media e il pallino sul valore di oggi.` Negative/zero denominators produce no indicator. Empty: `Con gli utili o la cassa di oggi questi multipli non hanno senso (sono negativi o mancano).` or, when statement currency ≠ quote currency, `I bilanci sono in {0} e il prezzo in {1}: i multipli col prezzo non si calcolano.`
- b. `Per ogni azione` — table (rows: `Ricavi`, `Utile`, `Cassa libera`, `Patrimonio`, `Dividendo`; columns: fiscal years + `12 mesi`; last column emphasised; `—` when missing; sparkline column `Andamento` desktop only). Description compares to today's price when currencies match. Note `Calcolati dall'app: voce di bilancio ÷ numero medio di azioni dell'esercizio.`
- c. `I conti dell'azienda` — `Esercizi annuali e ultimi 12 mesi, in valuta di bilancio.` Three mini bar charts `Ricavi`, `Utile netto`, `Cassa libera` with latest value (`ultimi 12 mesi` or year); margins `Margine lordo`, `Margine operativo`, `Margine netto`; `Crescita dei ricavi` (last year, coloured, aside `media {n} anni {x%}` when ≥2 years of growth).
- d. `Quanto rende il capitale` (`ROE`, `ROA`, `ROIC (prima delle tasse)`, `Copertura degli interessi`) and `Debiti e solidità` (`Debiti / patrimonio`, `Debito netto / EBITDA`, `Liquidità corrente`, `Payout`); each panel hidden when empty.

**Stock without statements**: card `Numeri chiave` with Yahoo key stats (only available ones): `Capitalizzazione`, `P/E`, `P/E atteso`, `Prezzo / patrimonio (P/B)`, `Utile per azione`, `Rendimento da dividendo`, `Margine di profitto`, `Redditività del capitale (ROE)`, `Crescita dei ricavi`, `Debiti / capitale`, `Beta`, each with hint; footnote `Fonte: Yahoo Finance, aggiornata una volta al giorno. Dati non ufficiali, da usare come orientamento.` Empty: `Yahoo non ha risposto o non ha questi dati per il titolo. Riprova più tardi.` / `Nessun dato disponibile per questo titolo.`

**ETF / fund**:
- `Cosa c'è dentro` — `Primi {n} titoli: {x%} del fondo.` top 10 holdings with weight bars; sentence `{A, B e C} (e altri N) li hai anche in: {fondi|direttamente}.` when holdings overlap with other held instruments.
- `Settori` — `Parte azionaria del fondo.` sector weight bars sorted desc; footnote `Fonte: Yahoo Finance. Le aree geografiche arriveranno con i file degli emittenti.`
- `Anno per anno` (all non-stock types) — up to 6 most recent calendar-year price returns, current year `{anno} (finora)`; `Variazione del prezzo in ogni anno solare, senza dividendi né tasse.`
- `Quanto costa il paniere` — `Media pesata dei titoli contenuti nel fondo.` `P/E medio`, `P/B medio`, `P/S medio`, `Rendimento da dividendo` (Yahoo weighted averages; source `Fonte: Yahoo Finance, aggiornata una volta al giorno (non ufficiale).`).
- `Quanto ti costa tenerlo` (TER >0) — `Effetto del TER ({ter}) su 10.000 {cur} con un rendimento ipotetico del 5% l'anno.` Items: `Sulla tua posizione` `≈ {valore × TER} l'anno` (if held), `Dopo 10 anni` and `Dopo 20 anni` `−{costo}` with formula popover (10.000 × (1,05^n − (1,05 × (1 − TER))^n)).
- If no Yahoo data and status ≠ unsupported: `Numeri chiave` card with the unavailable message.

**Dividends** (any type with past ex-dividends): `Dividendi` — `Dividendo per quota con data di stacco nell'anno; l'anno in corso è parziale.` bars for last 6 calendar years (current year muted + `{anno} finora: {x} per quota.`), `Rendimento oggi` (TTM ÷ last close), `Sul tuo prezzo medio` (if held), `Crescita media` (`{±x%} l'anno`, CAGR over ≥2 full years), `Prossimo stacco` (announced date, `Data annunciata secondo Yahoo, da confermare.`).

Fundamentals are only fetched for automatic-price `azione`, `etf`, `fondo` (others: "unsupported", nothing shown). Yahoo key numbers cached 24 h (empty results 1 h).

#### 3.11 `Commento` (only when the server has a local model configured and the title has prices)
- Text `Un riassunto in parole semplici di come è andato il titolo, scritto da un modello in esecuzione sul server.`; button `Genera commento` / `Sto scrivendo…` / `Riscrivi` → `POST /api/instruments/{id}/commentary`. Shows the generated text, or `Il modello non ha risposto. Riprova tra poco.`, or server error (`Attendi qualche secondo prima di chiedere un altro commento` on 429, 20 s per-user cooldown; cached per user/instrument/last close/language for 12 h). Disclaimer `Generato automaticamente da dati di prezzo e numeri chiave: può sbagliare e non è una raccomandazione di investimento.`

### 4. Instrument settings dialog (`/investimenti/tasse` aliquote list and `/investimenti/proventi` coupons — IT only; see 07)
Not reachable from the security page, documented here because it edits per-user instrument settings.
- Header: instrument name, `Valgono solo per te: servono a stimare tasse e proventi.`
- `Imposte`: `Aliquota` select `Automatica ({x%})` | `26% (ordinaria)` | `12,5% (titoli di Stato)`; for ETF/funds `Armonizzato UE` `Automatico (sì|no)` | `Sì (UCITS)` | `No`.
- `Cedole` (bonds only): `Tasso annuo lordo (%)` (placeholder `Es. 3,85`), `Frequenza` `Annuale`|`Semestrale`|`Trimestrale` (default semiannual), `Scadenza` date; hint `Le date delle cedole si contano a ritroso dalla scadenza.` Client error `Per le cedole servono tasso e scadenza`.
- Actions `Torna all'automatico` (all null; disabled if nothing saved) and `Salva` / `Salvataggio…`.
- Server `PUT /api/instruments/{id}/settings`: taxRate ∈ allowed rates or null; taxHarmonized bool|null; couponRate >0 ≤0.3; frequency ∈ {1,2,4}; maturity date; coupon fields all-or-none (`Per le cedole servono tasso, frequenza e scadenza`); coupons only for bonds (`Le cedole si inseriscono solo per le obbligazioni`). All null deletes the row.
- **Country gating**: if the product country has no `taxes` feature (DE), any non-null `taxRate`/`taxHarmonized` → 403 `{code:"country_feature_unavailable"}`; tax fields are never written for DE (coupons still saved), and the all-null delete path is skipped.

### 5. Other instrument endpoints used elsewhere (cross-reference)
- `PATCH /api/instruments/{id}` rename (only own manual instruments; name 1–200; 403 `Solo gli strumenti manuali si possono rinominare`) — no UI found.
- `GET /api/instruments/{id}/price?date=` (prefill register form), `GET /api/instruments/backfill?ids=` (≤50 ids, polling every 2 s while running), `POST|DELETE /api/instruments/{id}/manual-prices` (manual price dialog), `PUT /api/instruments/{id}/breakdown` (sector/area correction) — see 07.

### 6. Country / locale gating summary
- No route gating: securities pages and `/api/instruments/*` are available for IT and DE.
- DE: position footnote variant (§3.6); tax settings rejected (§4). Commentary is generated in the user's language.

## Requirements

#### Search
- **SEC-001** The app shall not offer a standalone securities list; the legacy `/investimenti/titoli` route shall redirect to the Portafoglio.
- **SEC-002** The app shall let the user search instruments by name, ticker or ISIN once at least 2 characters are typed, debouncing input by 300 ms. _API: `GET /api/instruments/search?q=`_
- **SEC-003** Before typing, the app shall list the user's portfolio instruments as suggestions and rank them first among known results.
- **SEC-004** The app shall list known instruments only if linked to the user (created by, operated on, watched, alerted or configured), at most 8.
- **SEC-005** The app shall group market results by type in the order ETF, Azioni, Fondi, Obbligazioni, ETC, Crypto, with per-type filter chips when more than one type is present.
- **SEC-006** The app shall show at most 5 crypto results, keeping only exact symbol/name matches when stock results exist, and drop duplicate Yahoo crypto rows when CoinGecko found the coin.
- **SEC-007** The app shall tell the user explicitly when the market data source did not respond, distinct from "no results".
- **SEC-008** Choosing a market result shall create or reuse the instrument and then open its security page. _API: `POST /api/instruments`_
- **SEC-009** The app shall offer a `Non lo trovi?` form creating a "solo ISIN" bond (valid ISIN + type bond) or a private manual instrument (name required, 3-letter currency). _API: `POST /api/instruments`_

#### Watchlist
- **SEC-010** The app shall show a `Seguiti` section on the Portafoglio listing watched instruments not currently held, and hide it when empty or on error. _API: `GET /api/investments/titles`_
- **SEC-011** Each watchlist row shall show icon, name, type, `Seguito` badge, active-alert count, triggered-alert badge, last provider close (or `Nessun prezzo`) and day change, and open the security page on tap.
- **SEC-012** The app shall let the user follow and unfollow an instrument from its page with a single toggle, without confirmation. _API: `PUT /api/instruments/{id}/watch`, `DELETE /api/instruments/{id}/watch`_
- **SEC-013** Following an instrument shall be idempotent and trigger a ~380-day price history download; unfollowing shall keep its alerts and operations. _API: `PUT /api/instruments/{id}/watch`_
- **SEC-014** After follow/unfollow or alert changes the app shall refresh the titles list, the security page and the sidebar summary.

#### Security page
- **SEC-015** The app shall load the security page with one request for the selected chart period (default `1A`) and re-poll every 2.5 s while history is downloading. _API: `GET /api/instruments/{id}/analysis?period=`_
- **SEC-016** The app shall show loading skeletons and an error state with retry (`Impossibile caricare il titolo.` or the server message).
- **SEC-017** The header shall show name, type, ISIN, currency, `Posseduto` badge when held, last close (4 decimals below 10), day and 1-year change and close date, and the actions `Segui`/`Non seguire più` and `Registra`.
- **SEC-018** `Registra` shall open the Register-operation flow prefilled with the instrument (see 07).
- **SEC-019** The app shall show up to six key facts chosen by instrument type (stock, ETF/fund, other) followed by volatility and distance from the 52-week high, skipping unavailable values.
- **SEC-020** The chart shall offer periods `1M`, `3M`, `6M`, `1A`, `5A`, `Max`, colour the series by period direction, and show at most 240 points.
- **SEC-021** When the user holds the instrument, the chart shall mark each purchase within the period and draw the user's average price as a dashed line, with a legend.
- **SEC-022** The chart shall show explicit messages when there are fewer than 2 prices, distinguishing "downloading history" from "not enough prices".
- **SEC-023** The app shall use the user's manual prices in place of provider closes on the same date for chart and statistics.
- **SEC-024** The app shall show period returns (1 month, 3, 6 months, 1 year, YTD) only when history reaches the start date, and the 52-week range with the last close position.
- **SEC-025** The app shall show the user's position (value, gain vs average price with %, gross income received if >0, quantity, average price) in the instrument currency, without FX, fees or taxes.
- **SEC-026** The app shall show a 4-level risk scale from 1-year volatility (thresholds 8/15/25%) with the level word, band names and the worst drawdown of the last year, hidden when volatility cannot be computed.
- **SEC-027** For stocks, the app shall list held funds that contain the stock among top holdings with its weight.
- **SEC-028** For manual instruments with ISIN, the app shall let the user search provider quotations on demand and link one to switch to automatic prices. _API: `GET /api/instruments/{id}/quotation`, `POST /api/instruments/{id}/quotation`_

#### Price alerts
- **SEC-029** The app shall list the user's alerts for the instrument with direction, level and status (waiting, or triggered with date and close price).
- **SEC-030** The app shall let the user create an alert with direction (`Sale sopra`/`Scende sotto`) and a positive level in the instrument currency, accepting comma or dot decimals. _API: `POST /api/instruments/{id}/alerts`_
- **SEC-031** The app shall only offer alert creation for automatic-price instruments and explain otherwise.
- **SEC-032** The server shall reject an alert whose level the latest close already reached, and more than 10 active alerts per instrument, and the app shall display the server message.
- **SEC-033** The app shall let the user delete any alert (active or triggered). _API: `DELETE /api/instruments/{id}/alerts/{alertId}`_
- **SEC-034** Alerts shall be evaluated on daily closes once per evening, trigger once, and send one email linking to the security page; the triggered state shall be visible in the app even if the email fails.

#### Fundamentals & composition
- **SEC-035** For stocks with statements, the app shall show app-computed valuation multiples (P/E, P/S, P/B, P/FCF, EV/EBITDA, earnings yield) using the last close and TTM statements.
- **SEC-036** Valuation multiples shall show a historical min/max/average range across past fiscal years when at least 3 years are available.
- **SEC-037** Every computed indicator shall offer a "how it's calculated" view with the formula in words, the actual numerator ÷ denominator = value, and the source.
- **SEC-038** The app shall not compute price-based multiples when statement and quote currencies differ, and shall say so.
- **SEC-039** The app shall show per-share values (revenue, EPS, FCF, book, dividend) per fiscal year plus TTM.
- **SEC-040** The app shall show revenue, net income and free cash flow per fiscal year, gross/operating/net margins and revenue growth (last year and average).
- **SEC-041** The app shall show profitability (ROE, ROA, ROIC pre-tax, interest coverage) and solidity (debt/equity, net debt/EBITDA, current ratio, payout) when computable.
- **SEC-042** For stocks without statements, the app shall show Yahoo key numbers with hints or an explicit unavailable message.
- **SEC-043** For ETFs/funds, the app shall show top 10 holdings with weights and combined share, overlap with other holdings, and equity sector weights.
- **SEC-044** For ETFs/funds, the app shall show basket average P/E, P/B, P/S and dividend yield when provided.
- **SEC-045** For ETFs/funds with a TER, the app shall show the yearly cost on the user's position and the cost after 10 and 20 years on 10,000 at a hypothetical 5% return.
- **SEC-046** For non-stock instruments, the app shall show up to 6 calendar-year price returns, marking the current year as partial.
- **SEC-047** For instruments with past dividends, the app shall show per-share dividends for the last 6 calendar years, yield today, yield on the user's cost, average growth and next announced ex-date.
- **SEC-048** The page shall never present buy/sell judgements, target prices or analyst recommendations, and shall show the source/disclaimer note at the bottom.
- **SEC-049** When available on the server, the app shall let the user generate an AI commentary on demand, showing the disclaimer and handling the 20-second cooldown. _API: `POST /api/instruments/{id}/commentary`_

#### Instrument settings
- **SEC-050** The app shall let IT users override tax rate, EU-harmonised flag and (bonds) coupon rate, frequency and maturity per instrument, or reset all to automatic. _API: `PUT /api/instruments/{id}/settings`_
- **SEC-051** Coupon fields shall be required all together or not at all, and only for bonds (rate >0 ≤30%, frequency 1/2/4).
- **SEC-052** For DE users the app shall not expose tax-rate/harmonised settings; the server rejects them with 403 `country_feature_unavailable`. _API: `PUT /api/instruments/{id}/settings`_
- **SEC-053** The position footnote shall omit the reference to the Tasse tab for countries without the taxes feature.

## Mobile adaptation notes
- **Proposal — needs product sign-off:** The search picker opens as a full-screen search sheet with the field focused; results and the `Non lo trovi?` form scroll in the same sheet; type filter chips are a horizontally scrollable row.
- **Proposal — needs product sign-off:** Security page order on phone is exactly the order listed in §3; header actions: `Registra` as primary button, follow toggle as an eye icon button in the navigation bar (with accessible label `Segui` / `Non seguire più`).
- **Proposal — needs product sign-off:** Chart tooltip (hover) becomes press-and-hold scrubbing showing date and price; release hides it. Purchase markers are not individually tappable.
- **Proposal — needs product sign-off:** Indicator `?` popovers open as bottom sheets (formula, live calculation, source).
- **Proposal — needs product sign-off:** The `Per ogni azione` table keeps fiscal years as horizontally scrollable columns with the indicator name pinned; the sparkline column is omitted on phone (as web).
- **Proposal — needs product sign-off:** Mini bar charts show the value of a bar on tap (web uses hover `title`).
- **Proposal — needs product sign-off:** Alert deletion uses swipe-to-delete with a 5 s undo snackbar on both platforms; the API delete is sent when the snackbar expires. Unfollow shows a snackbar `Non segui più {nome}` with undo.
- **Proposal — needs product sign-off:** Price alert emails deep-link to `/investimenti/titoli/{id}`; mobile apps register this path as a universal/app link and open the native security page.
- **Proposal — needs product sign-off:** Polling while backfilling (2.5 s) runs only while the screen is visible and stops in background.

## Open questions
1. There is no full watchlist/list screen: watched-and-held instruments only show in Positions; watched ones only appear in «Seguiti», which is hidden while the Portafoglio shows its empty state (user with no operations). A pure watcher with no operations cannot reach the search from Portafoglio. Should mobile add a dedicated list?
2. Choosing a market search result creates a shared instrument row before the user does anything; with the isolation rule it then doesn't appear in `Già aggiunti` unless followed/operated. Confirm this is intended (mobile may want "open without creating").
3. Alert and follow toggles have no confirmation/undo on web; confirm the undo proposal.
4. Several user-visible strings bypass `t()` or are hard-coded Italian/locale: key-fact labels/notes (`utili ultimi 12 mesi`, `sui massimi`, `ogni 10.000`), `formatPerShare` and `formatIndicator` force `it-IT` and `anni`, chart period labels `1A`/`5A`, `sharedText` sentence, alert email (always Italian, it-IT formatting), `media {n} anni` aside. Mobile needs proper localized keys.
5. `parseTargetInput` only replaces the first comma and treats `1.250,5` incorrectly; define locale-aware parsing.
6. All calculations (multiples, ranges, TER cost, dividend facts, risk) are server-computed and returned in the analysis payload — good for parity — but the TER cost formula and `purchaseMarkers` mapping run client-side; mobile must replicate them.
7. `PATCH /api/instruments/{id}` (rename manual instrument) has no UI; expose on mobile?
8. The instrument settings dialog is only reachable from IT Tasse/Proventi pages, not from the security page; should mobile add a "Impostazioni strumento" entry on the security page?
9. Alerts only work if the server has Resend configured; self-hosted instances without email silently show triggered alerts only — consider push notifications on mobile (needs backend work).
10. The commentary feature depends on a server-side Ollama model; availability is only known via `commentaryAvailable` in the analysis payload.
11. Logos are served by `GET /api/instruments/{id}/logo` behind session cookies with `private` cache headers; mobile image loading needs authenticated requests.
