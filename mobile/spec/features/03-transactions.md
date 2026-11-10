# Transactions — Liquidità · Movimenti & Analisi
Status: draft · Source: `app/(app)/liquidita/layout.tsx`, `app/(app)/liquidita/page.tsx`, `app/(app)/liquidita/analisi/page.tsx`, `components/domain/liquidity/*`, `components/domain/expenses/*`, `components/domain/cashflow/*`, `lib/liquidity/*`, `lib/calc/expenses.ts`, `lib/calc/cashflow.ts`, `lib/calc/month-pace.ts`, `lib/calc/movements.ts`, `lib/overview/voice.ts`, `lib/validation/transactions.ts`, `lib/validation/budgets.ts`, `lib/queries/transactions.ts`, `lib/queries/budgets.ts`, `lib/queries/attention.ts`, `app/api/transactions/route.ts`, `app/api/transactions/[id]/route.ts`, `app/api/transactions/attention/**`, `app/api/budgets/**`, `next.config.ts` (redirects)

## Purpose
«Liquidità» is the cash section: one place for account balances, every movement (income and expense), and where the money goes. This file covers the shared section frame plus the two tabs **Movimenti** (the feed) and **Analisi** (period analysis). The tab **Conti** is in 04-accounts-bank-sync; **Categorie e regole** and the `/categorizza` flow (incl. «Ricategorizza») are in 05-categories-categorization; **Abbonamenti** has its own feature file. Amounts are in the user's base currency (`session.user.currency`, default `EUR`) and obey the «Nascondi importi» privacy mask. Available identically in IT and DE (no country gating found in this area).

Core money concepts (formulas in `domain/`):
- **Signed amount**: expenses are negative, income positive. Direction is never stored separately.
- **Excluded amount («Dividi»)**: the part of a movement that does not count as yours; stored with the same sign as `amount`; *effective amount* = `amount − excludedAmount`. All totals (spese, entrate, avanzo, groups, curves) use effective amounts.
- **Transfers** (category type `trasferimento`, e.g. «Trasferimenti tra i miei conti»): always fully excluded (`excludedAmount = amount`), shown in neutral colour with `Escluso dai conteggi`; they never count in income/expense totals and cannot be split.
- **Fallback category** («Da categorizzare», `isFallback=true`): a movement in it is "uncategorized" / «Da decidere».
- **Spending groups**: every expense category belongs to one of four groups — `Dovute`, `Volute`, `Te futuro`, `Saltuarie` — plus the virtual `Da categorizzare` group for fallback.

## Entry points & navigation
- Main navigation item «Liquidità» → `/liquidita` (Movimenti tab).
- Section tabs (`SectionTabs`; on phone the title opens the view sheet via `SectionHeading`), in order:
  1. `Movimenti` (`/liquidita`) — «Entrate e uscite, ricerca e categorie»
  2. `Analisi` (`/liquidita/analisi`) — «Dove vanno i soldi, mese per mese»
  3. `Conti` (`/liquidita/conti`) — see 04
  4. `Abbonamenti` (`/liquidita/abbonamenti`)
  5. `Categorie e regole` (`/liquidita/categorie`, with `/liquidita/regole`) — see 05
- Deep links: `/liquidita?conto=<accountId>` opens Movimenti pre-filtered on that account (used by Conti rows and account detail «Vedi i movimenti di questo conto»). `/liquidita/conti?rinnova=…` opens the bank renewal flow (see 04).
- Legacy redirects (permanent): `/spese` → `/liquidita`, `/transazioni` → `/liquidita`, `/movimenti` → `/liquidita`, `/movimenti/analisi|categorie|regole` → `/liquidita/<tab>`, `/cash-flow` → `/liquidita/analisi`, `/categorie` → `/liquidita/categorie`, `/conti` → `/liquidita/conti`. A saved start page pointing to an old path must resolve to the new one.
- Other entries: sidebar/topbar «da decidere» badges and Panoramica link to `/liquidita` or `/categorizza` (see 00, 02); import page `/importazioni` (see imports feature file).

## Screens

> **Phone layout (Phase 4R, web 0.81.0).** Heading «Movimenti ⌄» (`SectionViewsHeading`, yellow `+` add menu); month
> sentence; hero `Liquidità totale` (or the account) with `MoneyHero`, the change line «↗ +828 € negli ultimi 3 mesi»
> (`--pos`/`--neg` semibold + period phrase `nell'ultimo mese` / `negli ultimi 3 mesi` / `nell'ultimo anno` /
> `da quando c'è lo storico`), the full-bleed `TrendChart` (260, flat 12 % fill) and the centred `PeriodSelector`
> `1M 3M 1A Max` (TX-009…011, implemented in 4R part 2: all accounts = liquidity class of `GET /api/overview?period=`, one
> account = rebuilt backwards from `GET /api/transactions?accountId&from&limit=200` pages; manual accounts flat); account
> tiles then a dashed «+ Conto» tile (TX-012) opening the New-account dialog. Movement avatars show the category icon until
> a merchant logo loads (then the category as a corner badge). No rules between rows.

### 1. Section frame (all Liquidità tabs)
- Header: title `Liquidità`, subtitle `Conti, saldi e movimenti in un posto solo`.
- Primary button `Aggiungi` (icon-only on phone, a11y label `Aggiungi`) opens a menu:
  - `Un movimento` → Add-transaction dialog (§4).
  - `Un conto o una banca` → New-account dialog (see 04).
  - `Importa da CSV o Excel` → navigates to `/importazioni`.
- Shared state, kept while switching tabs (lives in the section, not persisted across app restarts): Analisi period (default `mese`) and reference date (default today), selected account filter (default all, or `?conto=`), category filter (default none), search text (default empty).
- Opening any Liquidità screen marks movements as seen: `POST /api/transactions/attention/seen` (best-effort, silent on failure), then refreshes the attention counts (this clears the "new movements" badge in navigation).

### 2. Movimenti (`/liquidita`)
Data: `GET /api/transactions?from=<Jan 1 of previous year>&to=<Dec 31 of current year>&type=tutte` (one window shared with the overview hero; filters are applied client-side), `GET /api/accounts`, `GET /api/categories`, `GET /api/categories/usage`, `GET /api/budgets`, `GET /api/transactions/attention` (`uncategorizedCount`), `GET /api/gocardless/connections`, net-worth snapshots (compact) for the liquidity history.

Layout top to bottom (desktop: feed left, "Il mese" column right; phone: single column, feed then "Il mese"):

**2a. Month sentence** (calculated voice, same engine as Panoramica):
- If ≥1 account: `Hai {totale} su {n} conto|conti.` (no decimals).
- Pace line vs the user's typical spend (average of the last 3 months with data, same day-of-month): no history → `{Mese}: finora hai speso {x}.`; within ±5% (min 1 unit) → `{Mese} procede in linea con il solito: {x} spesi.`; above/below → `{Mese} è partito sopra|sotto il solito: {x} spesi, {diff} in più|in meno della tua media a questo punto.`
- If uncategorized > 0: `{n} movimento aspetta|movimenti aspettano una categoria.`
- While loading, reserve the sentence's height (no layout jump).

**2b. Hero** (`LiquidityHero`):
- Label `Liquidità totale` (all accounts) or the selected account's name; big amount = sum of balances or that account's balance.
- Change line: `+/−{delta}` (no decimals, up/down icon, pos/neg colour) + period phrase: `nell'ultimo mese` / `negli ultimi 3 mesi` / `nell'ultimo anno` / `da quando c'è lo storico`. Hidden when not computable.
- Full-width area chart; touching/dragging shows nearest point date + value. Accessible description `{label}: da {primo} a {attuale} {frase periodo}.`
- Period segmented control (a11y `Periodo del grafico`): `1M`, `3M` (default), `1A`, `Max`. Not shared with Analisi.
- Series: all accounts → liquidity history from net-worth snapshots with today's total as last point; one account → balance reconstructed backwards from current balance and that account's movements (accounts whose balance follows their movements: linked banks and, since web #447, accounts fed by a file import — `followsTransactions` on `GET /api/accounts`; a manual account is a flat line at its balance).
- While a file import or bank sync is running, a note floats over the chart `Sto aggiungendo i nuovi movimenti: il grafico si aggiorna da solo appena finisco.`; from its end until the chart data has been reloaded it reads `Aggiorno il grafico con i nuovi movimenti…`; meanwhile the curve is dimmed (web #447, TX-076).

**2c. Account chips** (horizontal scroll, a11y group `Filtra per conto`):
- First chip `Tutti i conti` with the total; then one chip per account (balance without decimals + name; warning icon with SR text `: serve un intervento` when its bank link needs renewal — expiring ≤7 days, expired or error).
- Tapping selects the filter (single choice; selecting a chip filters hero, sentence-free month totals, and feed). Dashed last chip `+ Conto` opens New-account dialog.
- While accounts load: a placeholder block of the chips' height.

**2d. Import link**: `Importa da CSV o Excel →` → `/importazioni`.

**2e. Toolbar** (above feed):
- Search field, placeholder/a11y `Cerca nei movimenti`; case-insensitive substring match on description **or note**; trimmed.
- Segmented control `Tipo di movimento`: `Tutti` (default) · `Uscite` (amount < 0) · `Entrate` (amount > 0).
- Only if uncategorized count > 0: toggle chip `Da decidere ·{n}` (shows only movements in the fallback category; pressed state) and link `Categorizza con l'AI` → `/categorizza`.
- If a category filter is active (set from Analisi): removable chip with category name + ✕ (SR `Togli il filtro`).
- Filters combine (AND): account, category, search, type, «Da decidere».

**2f. Feed** (`MovementFeed`):
- Grouped by day, newest day first; within a day, server order (date desc). Day header: `Oggi`, `Ieri`, or localized `lunedì 5 ottobre` (year appended if not current year), with the day's net effective total `+/−{x}`.
- Shows 10 days, then button `Mostra altri movimenti` adds 10 more days each tap.
- Under the list, once at least one remote merchant logo has rendered: `Loghi forniti da Logo.dev` (link). Required attribution.
- States: loading → 5 skeleton rows (a11y `Caricamento dei movimenti`); error → `Impossibile caricare i movimenti.` + retry; filters return nothing → `Nessun movimento corrisponde ai filtri.`; no data in the window but data exists elsewhere → `Nessun movimento ancora: collega una banca o aggiungine uno a mano.`
- **Empty state** (no movements at all, no filters active):
  - No accounts: title `Prima serve un conto`, text `I movimenti vivono dentro un conto: crealo, poi aggiungi i movimenti a mano o importali da un file.`, primary `Crea un conto` (New-account dialog).
  - With accounts: title `Nessun movimento ancora`, text `Importa il CSV o l'estratto conto della banca, oppure registra un movimento a mano: le categorie e il mese si riempiono da soli.`, primary `Importa un file` (`/importazioni`), secondary `Aggiungi un movimento` (Add-transaction dialog).

**2g. Movement row** (`MovementItem`):
- Leading avatar = category icon/colour; if the server returned a merchant `logoPath`, the merchant logo replaces it and the category icon shows small in the corner once the logo loads. The avatar is the button to change category (a11y `Categoria: {nome}. Tocca per cambiarla`).
- Title: description (single line, truncated; full bank raw text available as tooltip/long-press when different from description).
- Subtitle: category name (`Senza categoria` if missing) · origin icon when the category was set automatically (rule `regola`, past choices `storico`, AI `assistente`, bank category from an imported file `banca`; confidence only in accessible description/tooltip; not shown for fallback) · account name (omitted when an account filter is active) · `· diviso` when split.
- Uncategorized rows: highlighted background, category name in negative colour.
- Trailing amount: `+`/`−` effective amount in pos/neg colour; if split, full amount struck through below (SR `Importo pieno`); transfers: full amount in neutral colour + `Escluso dai conteggi`.
- `Dividi` button visible inline on wide screens (not for transfers); on phone it is inside the «⋯» actions.
- «⋯» button (a11y `Altre azioni per {descrizione}`) toggles an inline action row:
  - `Dividi` (phone only; not for transfers) → Split sheet (§3b).
  - `Nota` / note icon → Note editor (§3c). Label/a11y `Aggiungi nota` or `Modifica nota`; error state `Salvataggio della nota non riuscito, riprova`.
  - Manual movements only (`source = manuale`): `Modifica` → Edit panel (§3d); `Elimina` → confirmation (§3e). Bank-synced movements (`source = auto`) cannot be edited or deleted.
- Saving status under the row: `Salvataggio…` / `Salvataggio non riuscito, riprova.`
- Tapping the row anywhere except the avatar and its buttons opens the movement detail (§3f, web #455).

**2h. «Il mese» column** (`MonthAside`), current calendar month, respecting the account filter:
- Section `Il mese` with link `Analisi` → `/liquidita/analisi`. Rows: `Entrate` `+{x}`; `Spese` `−{x}`; `Avanzo finora` = entrate − spese (`+`/`−`, pos/neg colour) with hint `Di solito a questo punto: {x} di spese` when history exists.
- Only if uncategorized > 0: section `Da decidere`, row `{n} movimento|movimenti`, hint `Senza categoria: decidili a gruppi, con le proposte`, button `Categorizza` → `/categorizza`.
- Section `Gruppi di spesa`: four rows in fixed order Dovute, Volute, Te futuro, Saltuarie, each with month amount and a bar proportional to the largest group (group colour).

### 3. Movement sub-views

**3a. Category picker** (opened by tapping the avatar; popover on desktop, bottom sheet on phone):
- Search `Cerca una categoria` (reset on every open); empty result `Nessuna categoria trovata`.
- Top: up to 6 most-used categories as large tiles; then categories grouped by spending group sections. Current category marked selected.
- Offered categories: fallback, all transfer categories, and categories matching the movement direction (income → `entrata`; expense → any non-`entrata` type).
- Toggle `Ricordala per i prossimi «{descrizione}»` — shown only when the movement is uncategorized or bank-synced; default ON when shown.
- One tap selects and closes; picking the current category does nothing.
- On success: toast `Spostata in {categoria}` with action `Annulla` (restores previous category via the same PATCH). If «Ricordala» on: create a merchant rule (`POST /api/categorization-rules` with `matchType: merchant`, pattern = merchant key of description, `replaceExisting: true`); then rule feedback toast: if it categorized other pending movements `Messo in {cat} anche un altro movimento` / `Messi in {cat} anche altri {n} movimenti`; if it would also change past movements already categorized (not by the user) a persistent toast offering `Cambialo/Cambiali` or `Lascialo/Lasciali così` (Ricategorizza flow, see 05).
- Server: changing category makes it a user choice (`categorySource = utente`), choosing the fallback clears the origin. A non-fallback, non-transfer category must match the sign (else 400 `La categoria scelta non è compatibile con la direzione della transazione`). Moving into a transfer category sets full exclusion; moving out of transfer resets exclusion to 0.

**3b. Dividi (split)** (inline panel on desktop under the row; bottom sheet on phone, title `Dividi {descrizione}`):
- Header `Dividi · {descrizione}`, full amount, question `Quanto di questa spesa è tuo?` / `Quanto di questa entrata è tuo?`.
- Shortcuts (a11y group `Scorciatoie`): `Tutta` (1/1), `Metà` (1/2), `Un terzo` (1/3), `Un quarto` (1/4). The shortcut matching the current own share (±0.005) is shown selected.
- `Importo` numeric field (decimal keypad, 0…full, step 0.01) committed on blur/Enter; slider 0…full step 0.01. Own share clamped to [0, full], rounded to cents; non-numeric input → full amount.
- Result: `Conta come tua spesa|entrata` {own} and `Esclusa dal conteggio` {full − own}.
- Buttons `Salva` (`Salvataggio…` while pending) and `Annulla`. Save sends `PATCH {excludedAmount: full − own}` (positive; server applies the sign). Server rejects |excluded| > |amount| (`Quota esclusa non valida`). Splitting an auto-categorized movement by hand marks its category as a user choice.

**3c. Note** (popover on desktop; bottom sheet on phone with title `Nota` and `Fatto`):
- Textarea, max 500 chars, placeholder `Aggiungi una nota (es. a cosa si riferisce questa spesa)`. Saved on close if changed (trimmed; empty → note removed). Available for manual and bank movements. Error: `Salvataggio non riuscito, riprova.`

**3d. Modifica movimento** (manual only; inline panel or sheet titled `Modifica movimento`):
- Fields `Descrizione`, `Data`, `Importo entrata|uscita` (positive). Each field auto-saves on blur if changed and valid (empty description/date or empty amount are ignored). Status: `Salvataggio in corso...` / `Salvataggio non riuscito, riprova.` / `Le modifiche si salvano da sole.` Button `Fatto` closes.
- Server: description non-empty; amount > 0 (sign kept from current direction/category); date `YYYY-MM-DD`; re-validates split. On an `auto` movement these fields return 403.

**3e. Delete** (manual only): confirmation title `Eliminare questo movimento?`, body `«{descrizione}» verrà eliminato definitivamente.`, buttons `Annulla` / `Elimina` (`Eliminazione…`). `DELETE /api/transactions/{id}` (400 for auto movements).

**3f. Movement detail** (web #455; window on desktop, bottom sheet on phone; title for assistive tech `Dettaglio del movimento`). Opened by tapping a movement in Movimenti, in a Categorizza card or an expanded «Messe dall'app» row (05), or among a subscription's charges (06). The row already in the list is shown at once while `GET /api/transactions/{id}` brings the rest (origin, account, merchant summary as placeholders meanwhile).
- Header: merchant logo (else category avatar), description in the display face, `{weekday, day month year} · {account name}` (e.g. «lunedì 13 ottobre 2026 · Conto corrente»), amount `+`/`−` effective amount in pos/neg colour (transfers: full amount, neutral). Split: `Diviso: conta la tua parte su {0}` (full amount). Transfer: `Giroconto: escluso dai conteggi`.
- Actions under the amount: `Dividi` (not for transfers, opens §3b inside the sheet), and for manual movements `Modifica` (§3d inside the sheet) and `Elimina` (§3e confirmation; closes the sheet on success).
- Category block: avatar, category name (`Senza categoria` when unknown; the fallback highlighted in negative colour), who chose it, button `Cambia` → category picker (§3a: same offered categories, `Ricordala…` for uncategorized or bank-synced movements, `Spostata in {0}` + `Annulla`). Who chose it: `Scelta da te` (utente); rule still matching → `Messa dalla tua regola per «{0}»` (merchant rule) / `Messa dalla tua regola: il testo contiene «{0}»` (contains rule), rule no longer matching → `Messa dall'app con una tua regola`; `banca` → `Messa dall'app: nel file la banca la chiama «{0}»` / `Messa dall'app con la categoria scritta dalla banca nel file`; `storico`/`assistente` → the 05 origin descriptions with confidence; nothing for the fallback or legacy rows.
- `Chiedi all'AI` (only when the AI service is available on the server and the movement is not a transfer): asks which category the model would give (`POST /api/transactions/{id}/ai-suggestion`, writes nothing). Button `Chiedo all'AI…` while waiting. Answers: `ok` and same category → `L'AI è d'accordo con questa categoria`; `ok` with another category → `L'AI la metterebbe in` + category avatar and name + `Sicura al {0}%` + `Usa questa` (saves it as the user's choice, without rule) / `Lascia così`; `blocked` → `Sembra un trasferimento o un pagamento a una persona: per riservatezza non lo mandiamo all'AI.`; `limited` → `Hai chiesto molte volte nell'ultima ora: riprova più tardi.`; `disabled` (or the assistant switched off in settings, without calling) → `L'assistente per le categorie è spento.` + `Accendilo in Impostazioni` (opens Impostazioni → Assistente per le categorie); anything else / error → `L'AI non ha risposto. Riprova tra poco.`
- Facts: `Da dove arriva` — `Dalla banca collegata, {0}` / `Dalla banca collegata`, `Da un file importato, formato «{0}»` / `Da un file importato`, `Dall'estratto conto di {0}`, `Dai dati d'esempio`, `Aggiunto da te`; `Testo della banca` (raw description, only when it differs); `Codice esercente (MCC)` (only when present); `Registrato il` (creation day).
- Note: label `Nota`, placeholder `Scrivi qualcosa da ricordare su questo movimento`, max 500 characters, saved when the field loses focus (or the sheet closes) if changed; status `Salvataggio…` / `Nota salvata` / `Nota non salvata, riprova.`
- `Da questo esercente` (only when the same merchant, same direction, appears at least twice in the last 365 days): `{0} movimenti nell'ultimo anno, {±total} in tutto`, then up to 5 most recent other movements (date with year + signed counted amount), each opening its own detail in the same sheet.
- Errors: 404 → `Questo movimento non c'è più` + `Forse è stato eliminato o sostituito da un nuovo import.` + `Chiudi`; other failures → `Impossibile caricare il movimento` + `Controlla la connessione e riprova.` + `Riprova` / `Chiudi`.

### 4. Add transaction dialog («Nuovo movimento»; full-screen on phone)
- Header `Nuovo movimento`, description `Una spesa o un'entrata su un conto manuale.` Two steps with progress (`Passi del nuovo movimento`).
- **Step 1 `Quanto è stato?`**: segmented `Uscita` (default) / `Entrata` (changing it resets the chosen category); `Importo` currency input (autofocus). Validation: > 0 → `Scrivi un importo maggiore di zero.` Button `Continua`.
- **Step 2 `Per cosa è?` / `Da dove arriva?`**:
  - `Descrizione` (placeholder `Es. Spesa al supermercato` / `Es. Stipendio di ottobre`); required → `Scrivi una breve descrizione, per ritrovarlo nell'elenco.`
  - `Categoria` picker: categories of the direction plus transfer categories; default = most-used eligible category until the user chooses. Required → `Scegli una categoria.` If none available: `Nessuna categoria di entrata disponibile: aggiungine una dalla scheda Categorie e regole.` / `Nessuna categoria disponibile: aggiungine una prima di registrare una spesa.`
  - Collapsed summary row `{Oggi|Ieri|YYYY-MM-DD} · {conto}` with `Cambia` expanding: `Data` (default today; quick buttons `Oggi`, `Ieri`; required → `Scegli la data del movimento.`) and `Conto` (manual accounts only; default first manual account; required → `Serve un conto manuale su cui registrare il movimento.`). Auto-expanded when there is an account/date error or no manual account.
  - No manual account: `I movimenti si registrano sui conti manuali, e non ne hai ancora uno.` + `Aggiungi un conto` (closes this dialog, opens New-account dialog); submit disabled.
  - Buttons: `Indietro`, `Aggiungi` (`Aggiungo…`), and secondary `Aggiungi e inserisci un altro` (keeps date/account/direction, clears amount/description/category, returns to step 1, status `Movimento aggiunto.` / `{n} movimenti aggiunti.` + `Puoi inserirne un altro.`).
- Server `POST /api/transactions`: `accountId` uuid of an own **manual** account (bank-linked → 400 `Non si può aggiungere una spesa manuale a un conto collegato`), `description` non-empty, `categoryId` own category, `amount` > 0, `direction` `entrata|uscita`, `date` `YYYY-MM-DD`. Sign derived from category type (transfer uses `direction`); transfer → fully excluded. Non-fallback → user choice; fallback → rules applied immediately (the response may already carry the rule's category). Demo data active → 409 `Stai esplorando i dati d'esempio: azzerali per aggiungere i tuoi.` Errors shown with report affordance.
- Note: adding a manual movement does **not** change the manual account balance (balance is maintained by the user, see 04).

### 5. Analisi (`/liquidita/analisi`)
Data: same transactions endpoint, window Jan 1 of (reference year − 1) … Dec 31 of reference year; categories; budgets. All figures respect the selected account filter; transfers are excluded via effective amounts.
- **Period stepper**: `‹` (`Periodo precedente`) label `›` (`Periodo successivo`, disabled when the period contains today). Segmented `Mese` (default) · `3 mesi` · `Anno` (a11y `Ampiezza del periodo`). Labels: `Ottobre 2026`; `Ago – Ott 2026` (or with both years); `2026`. 3 mesi = reference month and the two before; Anno = calendar year. Arrows move by 1 month / 3 months / 1 year.
- **Spese del periodo**:
  - Sentence: none → `In questo periodo non ci sono ancora spese.`; else `Finora hai speso {x}` (current month) / `Hai speso {x}` + `, {diff} in più|in meno del periodo prima` (if previous period > 0) + ` La voce che pesa di più è «{categoria}», il {p}%.`
  - Label `Spese del periodo`, big amount (effective expenses).
  - If previous period > 0: `▲ +{diff}` (neg colour) or `▼ −{diff}` (pos colour) `rispetto al periodo prima`.
  - Cumulative spend curve, one point per day from period start to min(period end, today). For the current month only: dashed reference line `Di solito` (average cumulative curve of up to 3 previous months with data) and caption `La linea tratteggiata è la tua spesa media nello stesso tratto di mese.`
- **Dove vanno i soldi** (`SpendByGroup`): donut with ≤5 slices (4 groups + Da categorizzare), centre = total `di spese`; tapping a slice highlights it (others dimmed), centre shows group name, amount, `{p}% delle spese`; tap again to release. Beside: one expandable block per group with amount > 0, sorted by amount desc: colour dot, group name, `{p}% delle spese · {n} categoria|categorie`, amount. Expanded: top 5 categories (icon, name, bar, amount) and `Mostra tutte ({n})` / `Mostra meno`. Bar: without a budget, share of the group (group colour); with a monthly budget (scaled to the period: ×3 for `3 mesi`, ×12 for `Anno`) it fills up to the budget (primary colour, negative once over) with `restano {0} su {1} di budget` or `{0} oltre il budget di {1}` under it (a11y `Budget usato: {0}% di {1}`). Section link to Categorie: `Imposta un budget`, or `Modifica i budget` when some category has one (web #432). Tapping a category sets the category filter and navigates to Movimenti. Empty: `Nessuna spesa da mostrare in questo periodo.`
- **Da dove arrivano**: income by category, desc, `+{x}` with hint `{p}% delle entrate`. Empty: `Nessuna entrata in questo periodo.`
- **Risparmio accumulato**: one row `Messo da parte` (≥0) / `In meno` (<0), hint `Entrate meno spese, mese per mese, nei mesi guardati`, value = cumulative (income − expenses) over the trend window (6 months ending in the reference month; 12 for `Anno`).
- States: error → `Impossibile caricare i dati dell'analisi.` + retry; loading → content renders progressively (no skeleton).
- **Budgets** (web #432): set in the category detail (05, CAT-099); Analisi draws budgeted categories against their budget (above) and the month-pace engine reads them.

### 6. Legacy components (present in code, not rendered)
`components/domain/expenses/{expenses-filter-bar (only reused by Debts picker), transaction-row, split-slider, expenses-period-selector, expenses-reference-nav, transactions-type-toggle, transactions-period-summary, uncategorized-callout, expense-trend-chart, category-breakdown-donut (with per-category budget editor)}` and `components/domain/cashflow/*` are not mounted by any route. They must **not** be ported.

## Requirements

#### Frame & navigation
- **TX-001** The app shall present Liquidità with tabs in this order: Movimenti, Analisi, Conti, Abbonamenti, Categorie e regole.
- **TX-002** The app shall offer an `Aggiungi` menu on every Liquidità tab with `Un movimento`, `Un conto o una banca`, `Importa da CSV o Excel`.
- **TX-003** The app shall keep account filter, category filter, search text and Analisi period/reference date when switching Liquidità tabs.
- **TX-004** The app shall mark movements as seen each time a Liquidità screen opens, ignoring failures. _API: `POST /api/transactions/attention/seen`_
- **TX-005** The app shall resolve the legacy paths `/spese`, `/transazioni`, `/movimenti` to Movimenti, `/cash-flow` and `/movimenti/analisi` to Analisi, `/movimenti/categorie|regole` and `/categorie` to the matching tab, and `/conti` to Conti (deep links, saved start page).
- **TX-006** The app shall open Movimenti filtered on an account when given the deep-link parameter `conto=<accountId>`.

#### Movimenti — overview
- **TX-007** The app shall load movements for the window from 1 January of the previous year to 31 December of the current year in a single request with `type=tutte`, and apply all filters locally. _API: `GET /api/transactions?from=&to=&type=tutte`_
- **TX-008** The app shall show the month sentence with total balance and account count, the pace line versus the 3-month typical spend, and the count of movements awaiting a category when > 0. _API: `GET /api/accounts`, `GET /api/budgets`, `GET /api/transactions/attention`_
- **TX-009** The app shall show a hero with `Liquidità totale` or the selected account's name, its balance, the change over the chosen period and a trend chart.
- **TX-010** The hero period selector shall offer `1M`, `3M`, `1A`, `Max`, defaulting to `3M`.
- **TX-011** For all accounts the hero series shall come from liquidity net-worth snapshots with today's total as last point; for one linked account it shall be reconstructed backwards from its current balance and movements; for a manual account it shall be flat. _API (web): `GET /api/net-worth/snapshots?from=2000-01-01&to=<today>&compact=1`; mobile: the `liquidita` class of `GET /api/overview?period=&today=` (same server series) and, for one account, `GET /api/transactions?accountId=&from=&limit=200` (paged) — `LiquidityHero` in the domain layer._
- **TX-012** The app shall show account chips `Tutti i conti` + one per account with balance, a warning marker on accounts whose bank link needs renewal, and a `+ Conto` chip opening the New-account dialog. _API: `GET /api/gocardless/connections`_
- **TX-013** Selecting an account chip shall filter hero, month column and feed to that account.

#### Movimenti — toolbar & feed
- **TX-014** Search shall match, case-insensitively, the trimmed text against description or note.
- **TX-015** The type filter shall offer `Tutti` (default), `Uscite` (amount < 0) and `Entrate` (amount > 0).
- **TX-016** When uncategorized count > 0 the app shall show a `Da decidere ·{n}` toggle restricting the feed to fallback-category movements, and a `Categorizza con l'AI` link to `/categorizza`.
- **TX-017** When a category filter is active the app shall show a removable chip with the category name.
- **TX-018** The feed shall group movements by day (newest first) with header `Oggi`/`Ieri`/localized date (year only if not current) and the day's net effective total.
- **TX-019** The feed shall show 10 days initially and 10 more per `Mostra altri movimenti`.
- **TX-020** The app shall show `Loghi forniti da Logo.dev` below the feed once at least one remote merchant logo has been displayed.
- **TX-021** The app shall show the specified loading skeleton, error-with-retry, no-match and empty-window messages for the feed.
- **TX-022** (changed by web #444) With no accounts, Movimenti, Analisi and Abbonamenti shall show, instead of their content, what the tab will hold with `Aggiungi un conto` (New-account dialog) and `Importa un file` (Importazioni): Movimenti `Prima serve un conto` / `Collega la banca o crea un conto a mano, poi importa l'estratto conto: qui vedrai entrate e uscite, giorno per giorno.`; Analisi `Qui vedrai dove vanno i soldi` / `Spese per categoria mese per mese, entrate e risparmio. Serve un conto con i suoi movimenti.`; Abbonamenti `Qui troverai i tuoi abbonamenti` / `Li cerchiamo da soli nei movimenti di un conto: quanto costano al mese e all'anno, e quando arriva il prossimo addebito.` With accounts but no movements and no filters, Movimenti shows `Nessun movimento ancora` with `Importa un file` and `Aggiungi un movimento`.

#### Movement row
- **TX-023** Each row shall show avatar (merchant logo when available, else category icon), description, category name, automatic-origin indicator, account name (unless filtered by account), `· diviso` if split, and the signed effective amount.
- **TX-024** Split rows shall also show the full amount struck through.
- **TX-025** Transfer rows shall show the full amount in neutral colour with `Escluso dai conteggi` and shall not offer `Dividi`.
- **TX-026** Uncategorized rows shall be visually highlighted and show the category name in the negative colour.
- **TX-027** The «⋯» actions shall offer `Dividi` (non-transfer), `Nota`, and—only for manual movements—`Modifica` and `Elimina`.

#### Category change
- **TX-028** Tapping the row avatar shall open the category picker with search, up to 6 most-used tiles and group sections, limited to fallback, transfer and direction-compatible categories. _API: `GET /api/categories`, `GET /api/categories/usage`_
- **TX-029** The picker shall show `Ricordala per i prossimi «…»` (default on) only for uncategorized or bank-synced movements.
- **TX-030** Picking a different category shall update it and show `Spostata in {categoria}` with `Annulla` restoring the previous category. _API: `PATCH /api/transactions/{id}`_
- **TX-031** With «Ricordala» on, the app shall create/replace a merchant rule and show the rule feedback (other movements categorized; offer to change past matches). _API: `POST /api/categorization-rules`_
- **TX-032** The server shall reject a non-fallback, non-transfer category whose direction differs from the movement sign (400).
- **TX-033** Assigning a transfer category shall fully exclude the movement; moving it out of transfer shall reset the excluded amount to 0.

#### Dividi
- **TX-034** The split view shall offer shortcuts `Tutta`, `Metà`, `Un terzo`, `Un quarto`, an amount field and a slider, all bounded to [0, full amount] with cent precision.
- **TX-035** The split view shall highlight the shortcut matching the current own share and show own share and excluded share live.
- **TX-036** Saving shall send `excludedAmount = full − own` (positive) and close the view on success. _API: `PATCH /api/transactions/{id}`_
- **TX-037** The server shall reject an excluded amount greater than the amount (`Quota esclusa non valida`).

#### Note, edit, delete
- **TX-038** The note editor shall accept up to 500 characters and save on close only if changed; an empty note removes it. _API: `PATCH /api/transactions/{id}`_
- **TX-039** The edit view for manual movements shall auto-save description, date and amount individually on field exit, ignoring empty values.
- **TX-040** The server shall return 403 when description, amount or date of a bank-synced movement are changed.
- **TX-041** Deleting a manual movement shall require confirmation `Eliminare questo movimento?`. _API: `DELETE /api/transactions/{id}`_

#### Add transaction
- **TX-042** The add dialog shall have two steps: (1) direction `Uscita`/`Entrata` and amount > 0; (2) description, category, and collapsible date/account.
- **TX-043** The add dialog shall default date to today (quick `Oggi`/`Ieri`), account to the first manual account, and category to the most-used eligible category.
- **TX-044** The add dialog shall list only manual accounts and, with none, explain it and offer `Aggiungi un conto`, disabling submit.
- **TX-045** The add dialog shall show the specified inline errors and move focus to the first invalid field.
- **TX-046** `Aggiungi e inserisci un altro` shall save, keep date/account/direction, reset the other fields, return to step 1 and show the running count.
- **TX-047** The server shall derive the stored sign from the category type (transfer: from `direction`), reject bank-linked accounts, and apply rules immediately when the fallback category is chosen. _API: `POST /api/transactions`_
- **TX-048** While demo data is active, creation shall fail with 409 and the message shall be displayed.

#### Month column
- **TX-049** The month column shall show current-month `Entrate`, `Spese`, `Avanzo finora` (= entrate − spese) and the typical spend hint when history exists.
- **TX-050** The month column shall show `Da decidere` with a `Categorizza` button only when uncategorized > 0.
- **TX-051** The month column shall show the four spending groups in fixed order Dovute, Volute, Te futuro, Saltuarie with bars relative to the largest.

#### Analisi
- **TX-052** Analisi shall offer period widths `Mese` (default), `3 mesi`, `Anno` with previous/next arrows, next disabled for the period containing today.
- **TX-053** Analisi shall show the spend sentence, effective expenses of the period, and the delta vs the previous equal period when the latter is > 0.
- **TX-054** Analisi shall plot daily cumulative spend up to today; for the current month it shall add the dashed `Di solito` reference and its caption.
- **TX-055** `Dove vanno i soldi` shall show a group donut and expandable group blocks (sorted by amount, groups with zero hidden) with top-5 categories and `Mostra tutte ({n})`.
- **TX-056** Tapping a donut slice shall highlight that group and open its block; tapping again shall release it.
- **TX-057** Tapping a category in `Dove vanno i soldi` shall set the category filter and navigate to Movimenti.
- **TX-058** `Da dove arrivano` shall list income by category with share of total income.
- **TX-059** `Risparmio accumulato` shall show cumulative income − expenses over 6 months ending at the reference month (12 for `Anno`).
- **TX-060** Analisi shall show `Impossibile caricare i dati dell'analisi.` with retry on load failure.
- **TX-061** All Movimenti and Analisi totals shall use effective amounts, so split exclusions and transfers do not count.

#### Budgets API (kept for clients)
- **TX-062** The client shall read monthly budgets per category for pace calculations. _API: `GET /api/budgets`_
- **TX-063** The server shall upsert a category's monthly budget (`monthlyAmount` ≥ 0) and reject transfer categories with 400 `I trasferimenti sono esclusi dal budget`; `DELETE` removes it (204, idempotent). _API: `PUT /api/budgets/{categoryId}`, `DELETE /api/budgets/{categoryId}`_

### Movement detail (web #455)
- **TX-064** Tapping a movement (row body in Movimenti, a movement in a Categorizza card or «Messe dall'app» row, a subscription charge) shall open its detail sheet, showing the listed row immediately and the rest when loaded. _API: `GET /api/transactions/{id}`_
- **TX-065** The detail shall show logo or category avatar, description, long date with weekday and account, signed effective amount (transfers: full, neutral), and the split or transfer note.
- **TX-066** The detail shall offer `Dividi` (not transfers) and, for manual movements, `Modifica` and `Elimina` with the same flows and confirmation as the row actions; deleting closes the sheet.
- **TX-067** The detail shall show the category with who chose it (user, rule — named when it still matches —, bank label, past choices or AI) and `Cambia`, which uses the row's category picker and undo toast.
- **TX-068** Where the AI service is available and the movement is not a transfer, `Chiedi all'AI` shall ask for a category without saving, and show the answer variants specified in §3f; `Usa questa` shall save the proposed category as the user's choice. _API: `POST /api/transactions/{id}/ai-suggestion`, `GET /api/user/ai-categorization`_
- **TX-069** The detail shall show where the movement came from, the bank text when different from the description, the merchant category code when present and the day it was recorded.
- **TX-070** The detail note shall save on leaving the field when changed (≤ 500 characters) with the status line `Salvataggio…` / `Nota salvata` / `Nota non salvata, riprova.` _API: `PATCH /api/transactions/{id}` `{note}`_
- **TX-071** When the merchant appears at least twice in the last year, the detail shall show `Da questo esercente` with count, total and up to 5 other movements, each opening in the same sheet.
- **TX-072** A missing movement (404) shall show `Questo movimento non c'è più`; other load failures shall show `Impossibile caricare il movimento` with `Riprova`.
- **TX-073** Amounts in the detail shall respect «Nascondi gli importi».

### Budgets in Analisi and chart refresh
- **TX-074** (web #432) In `Dove vanno i soldi`, a category with a monthly budget shall show a bar against the budget scaled to the period, with `restano {0} su {1} di budget` or `{0} oltre il budget di {1}`; the section shall link to Categorie with `Imposta un budget` / `Modifica i budget`. _API: `GET /api/liquidity/analysis` (`budget` per category)_
- **TX-075** (web #447) The single-account hero curve shall follow the account's movements for linked banks and for accounts fed by a file import (`followsTransactions`). _API: `GET /api/accounts`, `GET /api/liquidity/month`_
- **TX-076** (web #447) While a file import or bank sync runs, the hero chart shall show `Sto aggiungendo i nuovi movimenti: il grafico si aggiorna da solo appena finisco.`, then `Aggiorno il grafico con i nuovi movimenti…` until it has reloaded, with the old curve dimmed. (The Panoramica net-worth chart does the same, OV-044.)

## Mobile adaptation notes
- **Proposal — needs product sign-off:** The «⋯» inline action row becomes a bottom action sheet with `Dividi`, `Nota`, `Modifica`, `Elimina` (destructive style), opened by long-press or the accessibility action; additionally swipe-left on a row reveals `Dividi` and, for manual movements, `Elimina` (still confirmed). Since web #455 a tap on the row body opens the movement detail (TX-064), as on the web.
- **Proposal — needs product sign-off:** Raw bank description (web tooltip) is shown in the action sheet header under the description instead of hover.
- **Proposal — needs product sign-off:** Chart scrubbing on hero, Analisi curve and donut uses touch-and-drag with haptic tick on point change; the donut slice "lock" is a tap toggle (no hover state).
- **Proposal — needs product sign-off:** The desktop two-column layout (feed + «Il mese») becomes: sentence, hero, chips, a compact horizontal «Il mese» summary card (Entrate / Spese / Avanzo finora, tap → Analisi), toolbar, feed; the spending-group bars move to Analisi only on phone.
- **Proposal — needs product sign-off:** `Mostra altri movimenti` becomes infinite scroll loading 10 more days when the end is reached (still client-side over the same window).
- **Proposal — needs product sign-off:** The toolbar collapses to a search field + a filter button opening a sheet (type, «Da decidere», active category); active filters appear as removable chips under the search.
- **Proposal — needs product sign-off:** `Importa da CSV o Excel` on phone opens the system document picker flow defined in the imports feature; native date pickers replace `<input type=date>`; amount fields use a decimal keypad with locale separator.
- **Proposal — needs product sign-off:** Pull-to-refresh on Movimenti and Analisi refetches transactions, accounts, attention and connections.

## Open questions
1. ~~Budget editing~~ Resolved by web #432: the monthly budget is set in the category detail (05, CAT-099…101) and Analisi draws budgeted categories against it (TX-074).
2. Several legacy `expenses/` and `cashflow/` components (monthly income/expense charts, savings rate) are dead code; the brief mentions "income/expenses/net/savings month by month" — current Analisi only shows period totals, cumulative curve, groups, income sources and accumulated savings. Confirm the current scope is the target.
3. The fetch window is fixed (previous + current calendar year relative to today in Movimenti); older movements are unreachable in Movimenti. Need a paginated/ranged API for mobile memory and data-plan reasons?
4. `GET /api/transactions` returns all rows of a 2-year window unpaginated, with server-side logo resolution — potentially heavy on mobile networks.
5. Day-group totals sum effective amounts including transfers (0 effective), fine; but "Avanzo finora" uses the full month range while the hint compares to typical-so-far — confirm intended semantics.
6. `rememberedMessage`, category-avatar a11y label (`Categoria: …`) and `Senza categoria` are not passed through `tr()` — untranslated in en/de on web.
7. Analisi has no loading skeleton (only `aria-busy`); mobile should define one.
8. Bearer/cookie session: all endpoints rely on better-auth session cookies; the mobile auth mechanism must be specified platform-wide.
9. The rule-creation endpoint and Ricategorizza belong to 05; ensure that file covers `POST /api/categorization-rules` response fields `applied` and `pastMatches` used here.
