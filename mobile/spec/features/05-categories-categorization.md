# Categories & Categorization

Status: draft · Source: app/(app)/liquidita/categorie, app/(app)/liquidita/regole, app/(app)/categorizza, components/domain/categories, components/domain/categorization, lib/categories, lib/categorization, lib/queries/categories.ts, lib/queries/categorization.ts, app/api/categories/**, app/api/categorization-rules/**, app/api/merchant-logos/**, app/api/transactions/{categorize-suggestions,categorize-auto,categorize-apply,auto-categorized,recategorize}/**, app/api/user/ai-categorization, docs/decisioni/2026-10-11-categorizza-mobile.md, docs/decisioni/2026-10-12-categorizzazione-soglia-90.md

## Purpose

Let the user organise spending into categories grouped by spending group (Dovute / Volute / Te futuro / Saltuarie), plus income and transfers, and get every movement categorised with as little work as possible:

- **Rules** (merchant rules) always apply automatically, on sync, import (bank sync, personal CSV, broker imports) and manual entry.
- **Confident proposals** (≥ 70 %, `AUTO_APPLY_THRESHOLD = 0.7`; was 90 % before web #456) from past choices or from the AI assistant apply automatically when the option «Lascia che l'app scelga quando è abbastanza sicura» is on.
- **Bank categories** (web #456): when a personal CSV/Excel import has the bank's own category column, each movement takes the matching category without asking (`categorySource = banca`, origin «Banca»); the user's rules win, corrections teach later imports, no AI in the mapping (server-side, `lib/categorization/bank-category.ts`).
- Everything else lands in **Categorizza → «Da decidere»**, a card-by-card (swipe) flow or a list; what the app applied by itself in the last 30 days is listed in **«Messe dall'app»** (a history: nothing to confirm).
- **«Ricategorizza»** recomputes automatically-set categories with today's rules, with preview and 7-day undo.

## Entry points & navigation

- Liquidità shell (`/liquidita`) → tab «Categorie e regole» → `/liquidita/categorie` and `/liquidita/regole`, toggled by a `ManagementSwitch` with options `Categorie` / `Regole`.
- `/categorizza` (full page inside the app shell, not a Liquidità tab). Reached from:
  - Movimenti toolbar link `Categorizza con l'AI`;
  - Uncategorized callout above the movement list («N transazioni da categorizzare» → button `Categorizza`);
  - "fix" link of Liquidità attention items;
  - sync progress island link when movements remain to categorise;
  - toasts after auto-apply (`Guarda`).
- `/categorizza` header has a BackLink `‹ Movimenti` → `/liquidita`.
- A single "Da decidere" count is shared by Movimenti and Categorizza (attention endpoint; see 04-transactions / attention). The navigation badge on Liquidità was removed by web #451 (SHELL-016).
- AI consent, «Lascia che l'app scelga quando è abbastanza sicura» and personal AI instructions live in Impostazioni → «Assistente per le categorie» (see **15-settings**). Onboarding «Categorie» step (default/optional categories) is specified in the onboarding feature file; its data model is summarised below.
- Movement rows in Movimenti show the origin icon of an automatic category (`Regola`, `Le tue scelte`, `AI`, `Banca`) — specified in 04-transactions, using the vocabulary defined here.

No country gating applies to this area (available for IT and DE). Default category names/descriptions are localised client-side (see Categories data model).

## Screens

> **Phone layout (Phase 4R, web 0.81.0).** «Categorie e regole» is a Liquidità view: heading «Categorie e regole ⌄» (views
> sheet of Liquidità with this view active) and the yellow `+` add menu; an inline (not stretched) `Categorie | Regole`
> segmented control. Each group is a soft panel (`--muted @ 40%`, radius xl, padding 16) with dot + name + count and the
> description, then the categories as **wrapping chips** (pill, `--card` + 1 pt `--border`, min-h 40, avatar 28, name
> medium, `{budget}/mese` and the usage count) and a dashed «+ Aggiungi» chip. Regole: the info card carries the
> «Aggiungi regola» button.

### Categories data model (shared by all screens)

- Category fields: `id`, `name`, `type` ∈ `dovuta | voluta | futuro | saltuaria | entrata | trasferimento`, `color` (one of the swatch colors), `icon` (one of 64 icon keys in `CATEGORY_ICONS`), `description` (≤ 120 chars, optional), `isFallback`, `defaultKey`, `createdAt`.
- Exactly one **fallback** category per user (`isFallback = true`, default name «Da categorizzare», icon `help-circle`, color red). It is recognised only by the flag, never by name. It cannot be renamed, deleted, used in rules, or turned into `trasferimento`; its group is not editable in the UI. It accepts both signs.
- **Direction compatibility**: `entrata` categories only for positive amounts; `dovuta/voluta/futuro/saltuaria` only for negative amounts; `trasferimento` and fallback for both.
- **Transfers** (`trasferimento`, default «Trasferimenti tra i miei conti», icon `landmark`): any movement assigned there gets `excludedAmount = amount` (excluded from income/expenses, cash flow and budgets but still visible). Moving a category into or out of `trasferimento` rewrites `excludedAmount` of all its movements (full / 0) and deletes its budget when it becomes a transfer. Transfers are never proposed by the AI.
- **Defaults for new users**: 24 categories + fallback (from `DEFAULT_CATEGORIES`): Dovute — Affitto & Mutuo, Bollette & Telefono, Spesa, Trasporti, Salute, Assicurazioni, Rate & Prestiti; Volute — Ristoranti & Bar, Abbonamenti, Svago, Sport & Benessere, Shopping, Viaggi, Contanti; Te futuro — Risparmio, Investimenti; Saltuarie — Tasse & Bolli, Casa & Arredamento, Regali & Donazioni; Trasferimento — Trasferimenti tra i miei conti; Entrate — Stipendio, Interessi & Dividendi, Rimborsi, Altre entrate; fallback Da categorizzare. Each has a short description used by the AI.
- **Optional defaults** (off unless switched on in onboarding): Figli & Scuola, Animali, Pensione integrativa, Imprevisti, Lavoro autonomo.
- **Localisation of defaults**: the server stores names as created; the client maps categories with a `defaultKey` (or the fallback) whose stored name equals a known translation of the default to the current language, and replaces default descriptions with the localised one (DE profile has dedicated descriptions for `tasse` and `rimborsi`). A user-renamed category is never translated. Saving a name equal to the displayed localised label is not a rename (server ignores it).
- Group labels and descriptions: `Dovute` «Necessarie per vivere: senza queste avresti problemi pratici o legali.», `Volute` «Migliorano la qualità della vita, ma potresti farne a meno.», `Te futuro` «Risparmio e investimenti come spesa prioritaria, non come avanzo.», `Saltuarie` «Necessarie ma non mensili: tasse annuali, manutenzioni, regali.».
- **Usage counts**: number of movements per category in the last 365 days (`GET /api/categories/usage`), used for ordering pickers ("Per te"/"Più usate") and shown on tiles; cached 5 minutes so ordering stays stable while working.

### Liquidità · Categorie (`/liquidita/categorie`)

- `ManagementSwitch` (`Categorie` active / `Regole`), section title `Le tue categorie`, helper text `Trascina una categoria in un altro gruppo, oppure toccala per modificarla.` and button `Distribuisci colori`.
- Loading: skeleton block. Error: `Impossibile caricare le categorie.` with retry.
- **Board**: one column per section, in this order: Dovute, Volute, Te futuro, Saltuarie (always shown, even empty), `Entrate` («Stipendio, rimborsi e tutto ciò che entra.»), `Trasferimenti tra conti` («Spostamenti tra i tuoi conti: non contano come entrate o spese.»), and `Da categorizzare` («Movimenti non ancora assegnati: si sistemano da Transazioni.») only when it contains the fallback. Each column header: group color dot, title, count of categories, description.
- Within a column, categories are in creation order. Each **tile** shows avatar (icon on color), name, the monthly budget `{0}/mese` (no decimals, only when set; web #432) and usage count (only if > 0). Tapping a tile opens the Category detail.
- **Drag & drop** (web): a non-fallback tile can be dragged to another column (except «Da categorizzare») → `PATCH /api/categories/{id}` `{type}`; the tile is dimmed while saving. The group can also be changed in the detail (touch path).
- **Inline add** (every column except «Da categorizzare»): `+ Aggiungi` turns into a name field (placeholder `Nome, poi Invio`); submit creates the category in that column's type; empty name or Escape/blur with empty field cancels; server error shown under the field (e.g. `Categoria già esistente`). New categories get server-default color/icon.
- **Distribuisci colori**: confirmation `Distribuire i colori automaticamente?` / `Ogni categoria (esclusa "Da categorizzare") riceverà un colore diverso dalle altre. I colori attualmente assegnati manualmente verranno sovrascritti.` buttons `Annulla` / `Distribuisci` (`Distribuzione...`); error `Distribuzione non riuscita, riprova.`. Assigns a unique color (pool of 48) to each non-fallback category in creation order, atomically.

### Category detail (dialog; full-screen form on phone)

- Header: avatar, name, subtitle `{0} transazioni nell'ultimo anno` or `Nessuna transazione nell'ultimo anno`.
- `Nome` field: saves on blur/Enter; empty or unchanged reverts. Disabled for the fallback. Error (e.g. duplicate `Categoria già esistente`) shown under the field and the previous name restored.
- `Cosa ci va (facoltativo)` description (max 120, placeholder `Es. supermercato, alimentari`, hint `Aiuta l'assistente a proporre questa categoria agli esercenti giusti.`): saves on blur/Enter; empty string clears it. Hidden for fallback.
- `Gruppo` as a grid of choices (radio group, two columns on phone; each a pill with the group's colour dot: Dovute, Volute, Te futuro, Saltuarie, Entrata, `Trasferimenti`; selected one filled with a check; web #432): saves immediately. Hidden for fallback.
- `Budget al mese (facoltativo)` (expense groups only, not the fallback; web #432): amount field with the currency symbol, placeholder `Nessun budget`, a11y `Budget mensile per {0}`, hint `Lascia vuoto per non avere un tetto. Lo vedi in Panoramica e in Analisi, e negli avvisi email se li hai accesi.` Saved on leaving the field: a new amount → `PUT /api/budgets/{categoryId} {monthlyAmount}` (rounded to cents), emptied → `DELETE /api/budgets/{categoryId}`. Errors: not a number or negative → `Scrivi un importo, per esempio 300.`; save failed → `Non è stato possibile salvare il budget, riprova.` / `Non è stato possibile togliere il budget, riprova.` (field restored).
- `Colore` swatches and `Icona` grid (64 icons): each tap saves immediately (separate PATCH for color and icon).
- `Elimina categoria` (not for fallback): inline confirmation text `Le transazioni collegate passeranno a "Da categorizzare" e il budget associato verrà rimosso.` with `Annulla` / `Elimina categoria` (`Eliminazione...`); error `Eliminazione non riuscita, riprova.`. On success the dialog closes. Server: movements move to fallback with origin cleared (`categorySource`, `categoryConfidence`, `categorizedAt` = null; `excludedAmount` reset to 0 if the deleted category was a transfer), its budget and the category are deleted in one DB transaction.
- After any update/delete, categories, transactions, categorize suggestions and budgets are refreshed.

### Liquidità · Regole (`/liquidita/regole`)

- `ManagementSwitch` (`Regole` active), title `Regole automatiche`, text `Le regole assegnano da sole la categoria ai movimenti che riconoscono.`.
- Card `Regole di categorizzazione` with explanation: `Le regole si applicano da sole alle nuove transazioni. "Contiene" copre tutte le varianti: cambia esselunga via roma in esselunga per prendere ogni filiale.`
- Rules list ordered by `hitCount` descending. Loading skeleton; error `Impossibile caricare le regole.` + `Riprova`; empty `Nessuna regola ancora. Le regole nascono quando categorizzi le transazioni dalla pagina Categorizza.`
- **Rule row**: merchant logo (fallback: category avatar), editable pattern (saves on blur/Enter; empty/unchanged reverts; error reverts), match type select `Esatta` (`merchant`) / `Contiene` (`contains`), category select (all non-fallback categories), source badge `Appresa` / `Manuale`, `usata {n} volte`, delete button.
- Delete confirmation: `Eliminare questa regola?` / `Il pattern "{pattern}" non verrà più applicato automaticamente alle nuove transazioni.` `Annulla` / `Elimina` (`Eliminazione...`), error `Eliminazione non riuscita, riprova.`. Deleting a rule does not change already categorised movements.
- **New rule form** (shown when at least one category exists): `Pattern` (placeholder `Es. esselunga`, required → `Il pattern è obbligatorio`), `Tipo` (default `Contiene`), `Categoria` (default first non-fallback; required → `Seleziona una categoria`), button `Aggiungi regola` (`Aggiunta in corso...`). Server errors shown below (e.g. `Esiste già una regola con questo pattern`).
- Server rules: pattern is normalised with `merchantKey` (lower-case, no accents/punctuation, numbers, bank-noise tokens like `pagamento`, `pos`, `carta`, and company suffixes like `srl`, `spa`, `gmbh` removed) before saving and comparing; duplicate type+pattern → 409 unless `replaceExisting`; fallback category → 400; foreign category → 404.
- **Matching**: exact (`merchant`) rules win over `contains`; among `contains` matches the longest pattern wins, ties → most recent; rules incompatible with the movement's direction are skipped.
- **After saving (create/update)** a rule applies immediately to movements still «Da categorizzare». Feedback (shared with Movimenti «Ricordala»):
  - if `applied > 0` and no past matches: toast `Regola applicata subito a un movimento da categorizzare` / `Regola applicata subito a {0} movimenti da categorizzare`;
  - if `pastMatches > 0` (movements already categorised automatically or before origin tracking that the rule would change): persistent toast (no auto-dismiss) titled with the applied text or `Regola salvata`, description `Vale anche per un movimento passato, che oggi ha un'altra categoria. Lo cambio?` / `Vale anche per {0} movimenti passati, che oggi hanno un'altra categoria. Li cambio?`, actions `Cambialo`/`Cambiali` (runs Ricategorizza scope `regola`) and `Lascialo così`/`Lasciali così`.
- When at least one remote logo is displayed, credit line `Loghi forniti da Logo.dev` (link) appears under the list.

### Categorizza (`/categorizza`)

- Header: BackLink `‹ Movimenti`, title `Categorizza`, subtitle (desktop only) `Quando è abbastanza sicura l'app mette la categoria da sola: qui scegli le altre e controlli quelle già messe.`, overflow menu `⋯` (`Altre azioni`, disabled until categories load) with item `Ricategorizza` / `Rifà le categorie messe dall'app con le regole di oggi`.
- On phone (< 768 px): the AI button sits in the header (compact `AI` button) and only the card view exists (no `Una alla volta / Elenco` switch, no subtitle); the card fills the free screen height.
- Tabs (segmented, full width): `Da decidere · {n}` (n = movements, not groups, still to decide; plain `Da decidere` while loading) and `Messe dall'app` (no count since web #456). Default tab: always «Da decidere» («Messe dall'app» is a history looked at on request, not work waiting for the user).
- **Auto-apply on load**: the suggestions response lists `autoApply.readyKeys` (groups with a confident proposal). Those groups are hidden from «Da decidere» and the page calls `POST /api/transactions/categorize-auto` once per data load. On success with `applied > 0`: toast `1 movimento categorizzato da solo` / `{0} movimenti categorizzati da soli`, description `Le trovi in «Messe dall'app».`, action `Guarda` (switches tab). If the call fails, ready groups go back to «Da decidere».
- **Auto-apply prompt** (when the option is off): one row `Meno da fare · Quando è abbastanza sicura, l'app mette la categoria da sola e la ritrovi in «Messe dall'app».` + `Attiva` → `PATCH /api/user/ai-categorization {autoApply:true}` (server then runs auto-apply in background).
- **AI banner** (shown only if the AI service is available, tab «Da decidere», something to decide, and there are groups without proposal or a generation is running/finished):
  - Desktop: one row `AI` · badge `Novità` · status (`{0} esercenti senza proposta` / `{0} esercente senza proposta`, or after a run `{0} proposte pronte nelle carte`, or shimmer `Sto leggendo i tuoi esercenti…`) · button `Categorizza con l'AI` (`In corso…`).
  - Phone: compact header button `AI` (`In corso`).
  - Without consent, the button opens a confirmation: title `Attivare l'assistente per le categorie?`, text `Inviamo a un servizio di intelligenza artificiale solo il nome pulito dell'esercente (mai importi, date, IBAN, note o nomi di persone), insieme alle categorie e alle eventuali istruzioni personali, con richiesta di non conservare i dati.` + (option on) `Quando è abbastanza sicura l'app mette la categoria da sola, e la ritrovi in «Messe dall'app», dove puoi cambiarla; le altre le scegli tu.` or (off) `Le proposte restano da confermare.` + `Puoi disattivarlo quando vuoi in Impostazioni.`; buttons `Annulla` / `Attiva e categorizza con l'AI` (records consent via `PATCH /api/user/ai-categorization {enabled:true}`, then starts).
  - Start: `POST /api/transactions/categorize-suggestions/generate` → `{status: started|disabled|no_key}`; anything but `started` → error toast `L'assistente non è disponibile`. Then the client re-fetches suggestions every 4 s; a progress strip shows `Sto leggendo i tuoi esercenti… {done} proposte su {total}` (total = groups without proposal at start). Stops when none are missing, after 8 polls without change (once at least one appeared), or after 60 polls (~4 min); final toast `1 esercente ha una proposta` / `{0} esercenti hanno una proposta`. Newly confident proposals are then auto-applied by the normal load rule.
- Error loading suggestions: `Impossibile caricare le proposte di categorizzazione.` + retry. Loading: card skeleton.

#### «Da decidere» — card view («Una alla volta»)

- One card per **group** (= same merchant key **and** direction); groups sorted by number of movements descending.
- Counter above: `{0} esercenti da categorizzare` or `Ultima carta`. The next card is visible behind the active one (static, non-interactive); a third ghost edge when > 2 remain.
- Card content: merchant logo (or initial), merchant label, total amount (income in positive color), `1 movimento` / `{0} movimenti` · date range (e.g. «9 ott», «2–9 ott», «28 set – 9 ott», year added if not current year or crossing years); if > 1 movement, a preview of the most recent movements (2 on phone, 3 on wide screens; date, bank description if different from label, amount; `e un altro` / `e altri {0}`).
- Proposal block: `Categoria proposta`, category avatar + name, and origin line:
  - `regola` → `Simile alla tua regola «{0}»` (or `Simile a una tua regola`);
  - `storico` → `Come l'unico tuo movimento simile` / `Come tutti i tuoi {0} movimenti simili` / `Come {0} dei tuoi {1} movimenti simili` / `Come i tuoi movimenti passati`;
  - `assistente` → `Proposta dall'AI`.
  - Confidence percent never visible; only in tooltip/accessibility text `Sicura al {0}%: dal {1}% l'app la mette da sola.`
- Without proposal: `Nessuna proposta: scegli tu la categoria` + button `Scegli la categoria`.
- Checkbox `Usa sempre questa categoria per «{merchant}»` (the merchant part hidden on very narrow screens): when checked, the decision also creates/updates a learned rule (`appresa`). Never checked by default; nothing ever creates a rule without it.
- **Gestures** (existing web behaviour, kept on mobile): drag right beyond 110 pt → confirm (only if there is a proposal); drag left beyond 110 pt → open category sheet; drag up beyond 110 pt → skip. Stamps fade in while dragging: `È questa` (right), `Un'altra` (left), `Salta` (up); once past the threshold the card border changes color, the stamp becomes `Lascia: è questa` / `Lascia: un'altra` / `Lascia: salta` and a light haptic tick fires. Release below threshold snaps back. Card tilts up to 8° with horizontal drag.
- **Buttons** under the card: Undo (icon, `Annulla l'ultima scelta`, disabled when nothing to undo), `Cambia` (toggles to `Torna alla proposta`), `Conferma` (only with a proposal and not changing), Skip (icon, `Salta per ora`).
- Keyboard (desktop only): → or Enter confirm, ← change, ↓ skip, Z or Backspace undo; hint line `Frecce: → conferma, ← cambia, ↓ salta, Z annulla. Le scelte si salvano da sole dopo qualche secondo.`
- **Animations**: decided card exits in the chosen direction (right confirm, left change) in 280 ms; skipped card goes to the bottom of the deck (behind); the next card rises from the waiting position; undo brings the card back from the side it left. Reduced motion → fades only.
- **Skip** moves the group to the end of the queue (not saved).
- **Saving**: decisions accumulate and are saved together after 5 s without new decisions, when the page is hidden/left, or on unmount; until saved they are undoable. Save = `POST /api/transactions/categorize-apply` (chunked) with per group `{transactionIds, categoryId, excludedPercentage (proposal's split or 0), createRule: remember, merchantKey}`. On failure: error toast and the cards return to the deck.
- Category sheet («Scegli la categoria»): see below; on the card it excludes the fallback, the proposed category and categories of the wrong direction; description = merchant label.
- Empty deck: `Fatto, non c'è altro da categorizzare` (+ `Annulla l'ultima scelta` if possible).
- **Tour** (`Come funziona` button reopens it): 5 animated steps, auto-opened the first time (remembered on device):
  1. `Una carta per esercente` — `In alto l'esercente con il totale e le date, sotto la categoria proposta e perché. Qui arrivano solo i dubbi: quando è abbastanza sicura l'app mette la categoria da sola, e la trovi in «Messe dall'app».`
  2. `A destra: è questa` — `Trascina la carta a destra per confermare la categoria proposta.`
  3. `A sinistra: un'altra` — `Trascinala a sinistra per scegliere tu la categoria giusta.`
  4. `In alto: salta` — `Non sei sicuro? Trascinala in alto: torna in fondo al mazzo.`
  5. `Annulla e ricorda` — `Hai sbagliato? Annulla finché la scelta non è salvata (qualche secondo). Spunta «Usa sempre questa categoria» se vuoi che quell'esercente si categorizzi da solo.`
  Buttons `Salta`, `Avanti`, `Inizia` (last), step dots `Passo {0} di {1}`.

#### «Da decidere» — list view («Elenco», desktop/tablet only)

- Intro: `{0} movimenti da decidere, raggruppati per esercente.` + `Controlla la categoria proposta, spunta i gruppi giusti e premi Applica. Con «Ricorda gli esercenti» le prossime volte si categorizzano da soli.`; empty `Niente da decidere`.
- Header checkbox `Seleziona tutti ({n} gruppi pronti)`: selects only groups that have a chosen category and a compatible category.
- Group row: checkbox, logo, label, count · date range, total, category picker (preselected **only** with the proposal; never an arbitrary default; placeholder `Scegli categoria`), `Dividi` toggle (slider 0–100 % `Quota esclusa dal conteggio`, shows `Esclusa dal conteggio: {n}%` and `Spesa effettiva`/`Entrata effettiva` amount), origin line, warning `Le transazioni di questo gruppo avevano proposte diverse — controlla prima di applicare.` when applicable, expander `Mostra/Nascondi i {n} movimenti`. Disabled reasons: `Nessuna categoria disponibile per questa direzione`, `Scegli una categoria per continuare`. Choosing a category auto-selects the row.
- Sticky footer: selection summary (`Nessun gruppo selezionato` or `{n} transazioni in {m} gruppi`), checkbox `Ricorda gli esercenti` (default off; creates rules for all applied groups), button `Applica`. While applying: determinate progress `Applicate {x} di {y} transazioni`. Success toast `{0} transazioni categorizzate` or `{0} transazioni categorizzate, {1} regole create`. Partial failure: applied groups leave the selection, others stay selected; toast `Applicate {0} transazioni prima dell'errore, le altre restano selezionate: {1}`.

#### «Messe dall'app»

- Movements categorised automatically (rules, confident proposals, bank categories) in the last **30 days** (`AUTO_CATEGORIZED_RECENT_DAYS`, by `categorizedAt`), grouped by merchant + category; at most 1000 movements returned. A history, not a to-do list: nothing waits for a confirmation (web #456 removed «Va tutto bene» and `POST /api/transactions/auto-categorized/seen`).
- Summary: `Negli ultimi {0} giorni,` + `{n} movimenti hanno` / `1 movimento ha` + `la categoria messa dall'app` + reason + `. Non serve confermarle: se una non va, toccala e cambiala.` Reason: option on → `, con le tue regole o perché era abbastanza sicura` (`, con le tue regole, con la categoria della banca o perché era abbastanza sicura` when some row has origin `banca`); option off → `, con le tue regole` (`, con le tue regole o con la categoria della banca` with bank rows).
- Row: logo, label (tap expands all movements; each movement opens its detail, TX-064), count · date range, total, category chip (tap → category sheet `Cambia categoria`), origin badge `Regola` / `Le tue scelte` / `AI` / `Banca` (tooltip: `Messa dall'app con una tua regola`, `Messa dall'app: la scegli sempre per questo esercente (sicura al {n}%)`, `Messa dall'app: proposta dell'AI (sicura al {n}%)`, `Messa dall'app: nel file la banca la chiama «{0}»` or, without the label, `Messa dall'app con la categoria scritta dalla banca nel file`).
- Correcting: sheet footer checkbox `Usa sempre questa categoria per «{merchant}»`, **checked by default**; picking applies via `categorize-apply` (source becomes user) and toast `Categoria cambiata` / `Categoria cambiata, anche per i prossimi`. Row is disabled while saving.
- Empty: `Ancora niente qui` + `Qui compaiono i movimenti a cui l'app ha messo la categoria da sola: con le tue regole o perché era abbastanza sicura.` (option off: `Qui compaiono i movimenti a cui l'app ha messo la categoria con le tue regole. In Impostazioni puoi lasciarla scegliere anche quando è abbastanza sicura.`). Loading: 3 row skeletons.

#### Ricategorizza (dialog; full-screen on phone)

- Title `Ricategorizza`, description `Rifà le categorie che l'app ha messo da sola, con le tue regole e le tue scelte di oggi. Quelle che hai scelto tu non cambiano.`
- If an undoable last run exists (≤ 7 days, not undone): row `Ultima volta il {date}: {n} movimenti` + `Annulla`.
- Preview `GET /api/transactions/recategorize?legacy=1`: groups per merchant with checkbox, logo, label, count · date range (+ ` · forse scelti da te` / `{n} forse scelti da te` for movements categorised before origin tracking), total, `from` category (struck through) → `to` category, origin badge. Groups with legacy movements start **unchecked**; others checked. Text `{n} movimenti cambierebbero categoria. Cambiano solo quelli con la spunta` + `; quelli «forse scelti da te» partono senza.`
- Never touches user choices (`utente`) or manually split movements; uses only saved proposals (no new AI calls); evidence for history comes only from the user's choices.
- Footer button: `Cambia {n} movimenti` / `Cambia 1 movimento` / `Spunta cosa cambiare` (disabled at 0); empty preview → `Niente da cambiare` / `Le categorie messe dall'app sono già quelle che sceglierebbero oggi le tue regole.` + `Chiudi`. Error `Impossibile calcolare cosa cambierebbe.` + retry.
- Apply `POST /api/transactions/recategorize {scope:"tutto", includeLegacy:true, groupKeys}` (recomputed server-side, synchronous). Result toast (10 s) `{n} movimenti hanno cambiato categoria` / `Un movimento ha cambiato categoria`, description `Li trovi in «Messe dall'app».`, action `Annulla`. If nothing changed: `Niente da cambiare: nel frattempo questi movimenti sono già cambiati`.
- Undo `POST /api/transactions/recategorize/undo {runId}` (7 days; only movements untouched since): toast `{n} movimenti sono tornati com'erano` / `Un movimento è tornato com'era` / `Nessun movimento da riportare indietro: li hai già cambiati tu`; 404 `Questa ricategorizzazione non si può più annullare`. Run records are kept 30 days.

### Category sheet («Scegli la categoria») — shared picker

- Bottom sheet on phone (80 % height), centred window from 640 px. Title (default `Scegli la categoria`), optional description (merchant), search field `Cerca categoria…` (not auto-focused on phone), sections: `Per te` (up to 5 most-used chips; only when the user has ≥ 8 categories and some usage), then icon grid per group (Dovute, Volute, Te futuro, Saltuarie, Entrate, `Esclusi da entrate e spese`), alphabetical within group; unknown legacy types under `Altre`; fallback last without header (callers usually exclude it).
- Search: accent-insensitive; every word must be in the name (rank: prefix, word-prefix, contains) or the query matches the group label; results sorted by rank, then usage, then name; Enter picks the first. Empty: `Nessuna categoria trovata`. Search resets every time the sheet opens.
- One tap picks and closes. Optional fixed footer (e.g. «Usa sempre…» checkbox).
- The list view uses the combobox variant (`CategoryPicker`) with the same ordering rules.

### Merchant logos

- Each suggestion group / auto group / rule carries `logoPath` (server-relative URL or null). Resolution order: brand dictionary (`MERCHANT_LOGO_DOMAINS`) → website written in the movement (e.g. «NETFLIX.COM», intermediaries like PayPal excluded) → Logo.dev name search (only expenses, never bank transfers, only for names seen in ≥ 3 users, exact name match, ≤ 100 searches/day, cached for all).
- Images are served by our server: `GET /api/merchant-logos/{domain}?s=<sig>` and `GET /api/merchant-logos/name/{name}?s=<sig>` (HMAC-signed by the server; dictionary domains need no signature; 404 → show initial). Requires an authenticated session.
- Display: initial letter on tinted circle until the image loads or if it fails; loaded logos on white background (also in dark theme). Decorative (name always shown next to it).
- Whenever at least one remote logo has been shown in a list, display `Loghi forniti da Logo.dev`.

### AI assistant (consent & instructions) — summary, owned by 15-settings

- `GET/PATCH /api/user/ai-categorization` → `{enabled, available, instructions, autoApply}`; PATCH accepts `{enabled}`, `{instructions}` (trimmed, ≤ 2000 chars) or `{autoApply}`.
- AI consent is off by default for existing users (asked in onboarding for new users when the service is configured). Only the cleaned merchant name is sent (no amounts, dates, IBAN, notes, person names; transfers and person-to-person payments filtered), with categories+descriptions and personal instructions.
- Revoking consent stops requests; saved AI proposals no longer auto-apply. Changing instructions deletes only pending proposals of the user. Turning `autoApply` on runs auto-apply on waiting movements in background.
- After every bank sync and import, if consented, the assistant proposes a category per merchant still uncategorised (5 merchants per request); confident ones auto-apply if the option is on.

## Requirements

#### Data model & categories board

- **CAT-001** The app shall load the user's categories ordered by creation date. _API: `GET /api/categories`_
- **CAT-002** The app shall localise the display name of default categories (identified by `defaultKey` or `isFallback`) only when the stored name equals a known translation of that default, and shall never translate user-renamed categories.
- **CAT-003** The app shall treat the category with `isFallback = true` as «Da categorizzare» regardless of its name.
- **CAT-004** The app shall enforce direction compatibility: `entrata` categories for positive amounts, expense groups for negative amounts, `trasferimento` and fallback for both.
- **CAT-005** The Categorie screen shall show a `ManagementSwitch` with `Categorie` and `Regole` linking to `/liquidita/categorie` and `/liquidita/regole`.
- **CAT-006** The board shall show sections in the order Dovute, Volute, Te futuro, Saltuarie, Entrate, Trasferimenti tra conti, each with title, category count and description; the four expense groups shall be shown even when empty.
- **CAT-007** The board shall show the «Da categorizzare» section only when it contains the fallback category, and it shall not accept moves or new categories.
- **CAT-008** Each category tile shall show icon/color avatar, name and its usage count over the last 365 days when greater than zero. _API: `GET /api/categories/usage`_
- **CAT-009** Tapping a tile shall open the category detail.
- **CAT-010** The user shall be able to move a non-fallback category to another section, saving the new `type` immediately and showing the tile as pending while saving. _API: `PATCH /api/categories/{id}`_
- **CAT-011** Each section except «Da categorizzare» shall offer `+ Aggiungi`, creating a category with the typed name and the section's type; an empty name cancels; server errors (e.g. `Categoria già esistente`, 409) are shown inline. _API: `POST /api/categories`_
- **CAT-012** `Distribuisci colori` shall ask for confirmation with the specified copy and then assign a unique color to every non-fallback category atomically. _API: `POST /api/categories/distribute-colors`_
- **CAT-013** Loading shall show a skeleton and load failure shall show `Impossibile caricare le categorie.` with retry.

#### Category detail

- **CAT-014** The detail shall show avatar, name and `{0} transazioni nell'ultimo anno` or `Nessuna transazione nell'ultimo anno`.
- **CAT-015** Name changes shall save on blur/submit; an empty or unchanged name reverts; on error the message is shown and the previous name restored. _API: `PATCH /api/categories/{id}`_
- **CAT-016** The name of the fallback category shall not be editable (server returns 409 on rename).
- **CAT-017** The description (`Cosa ci va (facoltativo)`, max 120 characters) shall save on blur/submit and an empty value shall clear it; it is hidden for the fallback.
- **CAT-018** (changed by web #432) The group selector shall offer the six types as a grid of choices and save immediately; it is hidden for the fallback, and the server shall reject turning the fallback into `trasferimento` (400).
- **CAT-019** Color (swatch list) and icon (64 allowed keys) shall save immediately on tap, for every category including the fallback.
- **CAT-020** Moving a category to or from `trasferimento` shall set `excludedAmount` of its movements to the full amount or to 0 respectively, and moving it to `trasferimento` shall delete its budget.
- **CAT-021** Deleting a non-fallback category shall require the inline confirmation `Le transazioni collegate passeranno a "Da categorizzare" e il budget associato verrà rimosso.` and shall be impossible for the fallback (409). _API: `DELETE /api/categories/{id}`_
- **CAT-022** On deletion the server shall, in one transaction, move linked movements to the fallback with origin fields cleared (and `excludedAmount` reset if it was a transfer), delete its budget and the category.
- **CAT-023** After any category update or deletion the app shall refresh categories, movements, categorize suggestions and budgets.
- **CAT-099** (web #432) For expense-group categories (not the fallback) the detail shall offer `Budget al mese (facoltativo)`, saved on leaving the field; an empty field removes the budget. _API: `PUT /api/budgets/{categoryId}`, `DELETE /api/budgets/{categoryId}`_
- **CAT-100** (web #432) An invalid or negative budget shall show `Scrivi un importo, per esempio 300.`; a failed save or removal shall show its error and restore the saved value.
- **CAT-101** (web #432) Board tiles shall show the category's monthly budget as `{0}/mese` when set. _API: `GET /api/budgets`_
- **CAT-024** New users shall receive the 24 default categories plus the fallback, each default with its description; the five optional defaults are created only if enabled in onboarding.

#### Rules

- **CAT-025** The Regole screen shall list rules ordered by usage count descending with logo, editable pattern, match type (`Esatta`/`Contiene`), category, source badge (`Appresa`/`Manuale`) and `usata {n} volte`. _API: `GET /api/categorization-rules`_
- **CAT-026** The rules list shall show the specified loading, error (`Impossibile caricare le regole.` + `Riprova`) and empty states.
- **CAT-027** Editing a rule's pattern (on blur/submit), match type or category shall save immediately; empty or unchanged patterns revert, failed saves revert. _API: `PATCH /api/categorization-rules/{id}`_
- **CAT-028** Rule category choices shall exclude the fallback; the server shall reject the fallback (400) and foreign categories (404).
- **CAT-029** Deleting a rule shall require confirmation `Eliminare questa regola?` and shall not modify already categorised movements. _API: `DELETE /api/categorization-rules/{id}`_
- **CAT-030** The new-rule form shall require a non-empty pattern (`Il pattern è obbligatorio`) and a category (`Seleziona una categoria`), default type `Contiene`, and create a `manuale` rule. _API: `POST /api/categorization-rules`_
- **CAT-031** The server shall normalise rule patterns with the merchant-key normalisation before saving and comparing, and reject a duplicate type+pattern with 409 `Esiste già una regola con questo pattern` unless `replaceExisting` is set.
- **CAT-032** Rule matching shall prefer exact (`merchant`) rules, then the longest matching `contains` pattern (ties: most recent), skipping direction-incompatible rules.
- **CAT-033** A created or updated rule shall immediately categorise matching movements still «Da categorizzare», and the response shall return `applied` and `pastMatches`.
- **CAT-034** After saving a rule with `applied > 0` and no past matches, the app shall show `Regola applicata subito a {0} movimenti da categorizzare` (singular variant for 1).
- **CAT-035** After saving a rule with `pastMatches > 0`, the app shall show a persistent prompt (`Vale anche per {0} movimenti passati, che oggi hanno un'altra categoria. Li cambio?`) with `Cambiali` (Ricategorizza scope `regola`) and `Lasciali così`, which stays until the user chooses. _API: `POST /api/transactions/recategorize`_

#### Categorizza — structure & auto-apply

- **CAT-036** `/categorizza` shall show BackLink `‹ Movimenti`, title `Categorizza` and an overflow menu with `Ricategorizza`.
- **CAT-037** (changed by web #456) The page shall show two tabs, `Da decidere · {n}` (n = movements to decide) and `Messe dall'app` (no count). _API: `GET /api/transactions/categorize-suggestions`, `GET /api/transactions/auto-categorized`_
- **CAT-038** (changed by web #456) The default tab shall always be «Da decidere»; a user choice overrides it.
- **CAT-039** Suggestions shall be grouped by merchant key and direction and sorted by number of movements descending.
- **CAT-040** Groups listed in `autoApply.readyKeys` shall be hidden from «Da decidere» and the app shall request auto-apply once per suggestions load. _API: `POST /api/transactions/categorize-auto`_
- **CAT-041** After an auto-apply with `applied > 0`, the app shall show `{0} movimenti categorizzati da soli` with `Le trovi in «Messe dall'app».` and action `Guarda` that opens that tab.
- **CAT-042** If auto-apply fails, the ready groups shall reappear in «Da decidere».
- **CAT-043** (changed by web #456) A proposal shall be considered confident only if its confidence is ≥ 70 % and, for `storico`, at least 3 past movements agree; a group auto-applies only if confident and without divergent proposals.
- **CAT-044** Rules shall always apply automatically; confident `storico`/`assistente` proposals shall apply automatically only when `autoApply` is on, and `assistente` proposals only with AI consent.
- **CAT-045** When `autoApply` is off, the page shall show the prompt `Meno da fare · …` with `Attiva`, which turns the option on. _API: `PATCH /api/user/ai-categorization`_
- **CAT-046** Confidence percentages shall never be shown in visible text; they appear only in tooltip/accessibility text.
- **CAT-047** (changed by web #456) The origin of a category shall be described with the specified phrases for `regola`, `storico`, `assistente` and `banca`, with the matching icon (bookmark-check, history, sparkles, landmark).

#### Categorizza — AI generation

- **CAT-048** The AI entry shall be shown only when the service is available, the active tab is «Da decidere», there is something to decide, and some group lacks a proposal or a generation is running/finished.
- **CAT-049** On phone the AI entry shall be a compact `AI` button in the page header; on wide screens a one-row banner with `Novità` badge and status text.
- **CAT-050** Without consent, the AI button shall open the consent confirmation with the specified copy; confirming shall record consent and start generation. _API: `PATCH /api/user/ai-categorization`_
- **CAT-051** Starting generation shall call the generate endpoint and treat any status other than `started` as the error `L'assistente non è disponibile`. _API: `POST /api/transactions/categorize-suggestions/generate`_
- **CAT-052** While generating, the app shall poll suggestions every 4 s and show a progress strip `{done} proposte su {total}` with real counts.
- **CAT-053** Generation polling shall stop when no group lacks a proposal, after 8 unchanged polls once at least one proposal appeared, or after 60 polls, then toast `{0} esercenti hanno una proposta`.

#### Categorizza — cards

- **CAT-054** On phone «Da decidere» shall always use the card view; the `Una alla volta / Elenco` switch shall exist only on wide screens (≥ 768 pt).
- **CAT-055** Each card shall show logo, merchant label, total, movement count, date range and, with more than one movement, the most recent movements (2 on phone).
- **CAT-056** A card with a proposal shall show the proposed category and its origin; a card without shall show `Nessuna proposta: scegli tu la categoria` and `Scegli la categoria`.
- **CAT-057** The counter above the deck shall read `{0} esercenti da categorizzare` or `Ultima carta`, and the next card shall be visible behind the active one.
- **CAT-058** Dragging a card right beyond the threshold shall confirm the proposal (only when a proposal exists).
- **CAT-059** Dragging a card left beyond the threshold, tapping `Cambia`, or the ← key shall open the category sheet limited to non-fallback, same-direction categories excluding the proposed one.
- **CAT-060** Dragging a card up beyond the threshold or tapping skip shall move the group to the end of the deck without saving.
- **CAT-061** While dragging, the app shall show the direction stamp and, once past the threshold, change the stamp to `Lascia: …`, highlight the card border and emit a light haptic once.
- **CAT-062** Releasing below the threshold shall snap the card back.
- **CAT-063** The card shall offer `Usa sempre questa categoria per «{merchant}»`, unchecked by default; a rule shall be created only when checked.
- **CAT-064** Decisions shall be saved in a batch after 5 s without new decisions, or when the screen is hidden/left; until saved, `Annulla` shall restore the last decided card. _API: `POST /api/transactions/categorize-apply`_
- **CAT-065** If saving decisions fails, the app shall show an error and return the affected cards to the deck.
- **CAT-066** Confirming shall apply the proposal's suggested split percentage; choosing another category shall apply 0 % exclusion.
- **CAT-067** The decided card shall exit towards the chosen side, a skipped card shall go under the deck, and an undone card shall return from the side it left; with reduced motion only fades are used.
- **CAT-068** When the deck is empty the app shall show `Fatto, non c'è altro da categorizzare` and, if possible, `Annulla l'ultima scelta`.
- **CAT-069** The 5-step tour shall open automatically the first time on the device and be reopenable with `Come funziona`.

#### Categorizza — list view (wide screens)

- **CAT-070** The list view shall preselect a group's category only from its proposal and never assign an arbitrary default.
- **CAT-071** A group without a chosen category or without any compatible category shall not be selectable and shall show the reason.
- **CAT-072** `Seleziona tutti` shall select only selectable groups; choosing a category for a group shall select it.
- **CAT-073** `Dividi` shall let the user set an excluded share 0–100 % and show the effective amount.
- **CAT-074** `Applica` shall apply selected groups in sequential chunks with determinate progress, creating rules only if `Ricorda gli esercenti` is checked. _API: `POST /api/transactions/categorize-apply`_
- **CAT-075** On partial failure the applied groups shall leave the selection and the remaining ones stay selected, with toast `Applicate {0} transazioni prima dell'errore, le altre restano selezionate: {1}`.
- **CAT-076** The server shall reject the whole batch if any movement is incompatible with the chosen category's direction (400) or any id is not owned (404).

#### «Messe dall'app»

- **CAT-077** (changed by web #456) «Messe dall'app» shall list the movements categorised automatically in the last 30 days, grouped by merchant and category, with origin badge `Regola`, `Le tue scelte`, `AI` or `Banca`, and the summary sentence of the specified variants. _API: `GET /api/transactions/auto-categorized`_
- **CAT-078** Tapping a row's category shall open the category sheet titled `Cambia categoria` with `Usa sempre questa categoria per «{merchant}»` checked by default.
- **CAT-079** Picking a category shall re-categorise the whole group as a user choice, optionally creating the rule, and toast `Categoria cambiata` or `Categoria cambiata, anche per i prossimi`. _API: `POST /api/transactions/categorize-apply`_
- **CAT-080** Tapping a row's label shall expand all its movements.
- ~~**CAT-081**~~ Removed by web #456: «Messe dall'app» has nothing to confirm (no `Va tutto bene`, no `POST /api/transactions/auto-categorized/seen`).
- **CAT-082** (changed by web #456) The empty state shall show `Ancora niente qui` with the text variant depending on `autoApply`.
- **CAT-097** (web #455) Every movement listed inside a card («Da decidere») or an expanded «Messe dall'app» row shall open that movement's detail (TX-064) when tapped, with the accessible label `Apri il movimento del {0}`.
- **CAT-098** (web #456) A movement whose category came from the bank's column of an imported file shall carry origin `banca`; the origin description shall quote the bank's label (`bankCategory`) when known.

#### Ricategorizza

- **CAT-083** `Ricategorizza` shall open a dialog with a preview, per merchant, of movements whose automatic category would change, including legacy movements. _API: `GET /api/transactions/recategorize?legacy=1`_
- **CAT-084** Groups containing legacy movements («forse scelti da te») shall start unchecked; other groups checked.
- **CAT-085** Ricategorizza shall never change user-chosen categories or manually split movements, and shall not request new AI proposals.
- **CAT-086** The apply button shall read `Cambia {n} movimenti` for the checked groups and be disabled with `Spunta cosa cambiare` when none is checked. _API: `POST /api/transactions/recategorize`_
- **CAT-087** After applying, the app shall show `{n} movimenti hanno cambiato categoria` for 10 s with `Annulla`, or `Niente da cambiare: nel frattempo questi movimenti sono già cambiati` if nothing changed.
- **CAT-088** The last run shall be undoable for 7 days from the dialog or toast, restoring only movements not changed since. _API: `POST /api/transactions/recategorize/undo`_
- **CAT-089** An empty preview shall show `Niente da cambiare` with `Chiudi`; a preview error shall show `Impossibile calcolare cosa cambierebbe.` with retry.

#### Category sheet & logos

- **CAT-090** The category sheet shall offer search, a `Per te` row of up to 5 most-used categories (only with ≥ 8 categories and some usage) and an icon grid per group in alphabetical order.
- **CAT-091** Category search shall be accent-insensitive, match all words in the name or the group label, and rank prefix > word-prefix > contains > group match, then usage, then name.
- **CAT-092** The sheet search shall be empty every time it opens and shall not auto-focus on phone.
- **CAT-093** Merchant logos shall be loaded only from the server-provided `logoPath`, falling back to the initial on absence or failure. _API: `GET /api/merchant-logos/{domain}`, `GET /api/merchant-logos/name/{name}`_
- **CAT-094** Any list that displayed at least one remote logo shall show `Loghi forniti da Logo.dev`.
- **CAT-095** Logos shall be shown on a white background in both themes.

#### Amount privacy

- **CAT-096** Amounts on cards, rows, previews and Ricategorizza shall respect «Nascondi importi».

## Mobile adaptation notes

- **Proposal — needs product sign-off:** Board drag & drop → replace with a long-press "Sposta in…" action on a tile that opens a bottom sheet listing the six groups; the group selector in the detail sheet stays as the primary path. Do not implement free drag between columns on phone.
- **Proposal — needs product sign-off:** Board layout → one vertical scrolling list of section cards (same order as web), tiles wrapping as chips; no multi-column grid on phone.
- **Proposal — needs product sign-off:** Category detail → full-screen form sheet with explicit fields that save on "Done"/blur exactly like web (no global Save button); delete confirmation as a bottom-sheet confirmation with the same copy.
- **Proposal — needs product sign-off:** Rules screen → each rule is a list row (logo, pattern, `Esatta/Contiene` · category, `usata n volte`); tapping opens an edit sheet with Pattern, Tipo, Categoria (category sheet), and `Elimina regola`; swipe-to-delete on the row opens the same confirmation. New rule via a `+` toolbar button opening the same sheet. Inline-editable inputs in rows are not used on phone.
- **Proposal — needs product sign-off:** Categorizza list view is not offered on phone (as on web); keyboard shortcuts and the keyboard hint are omitted. Tablets ≥ 768 pt may show the list view.
- **Proposal — needs product sign-off:** Swipe thresholds expressed as 110 pt; haptic = light impact (iOS `UIImpactFeedbackGenerator(.light)`, Android `HapticFeedbackConstants.CONTEXT_CLICK` or equivalent), fired once when entering a zone and once on commit.
- **Proposal — needs product sign-off:** Deferred save of card decisions: flush pending decisions on app backgrounding (scene phase / lifecycle `ON_STOP`) and on leaving the screen, mirroring `visibilitychange`.
- **Proposal — needs product sign-off:** Tooltips with confidence (`Sicura al {0}%…`) → shown via long-press on the origin line/badge (popover on iPad), and always available as accessibility label.
- **Proposal — needs product sign-off:** Toast with persistent choice after a rule save (`Cambiali / Lasciali così`) → a non-auto-dismissing snackbar/banner with two actions that stays until a choice or until leaving the screen.
- **Proposal — needs product sign-off:** Overflow `⋯` menu → native toolbar menu; Ricategorizza as a full-screen sheet with sticky bottom action.
- **Proposal — needs product sign-off:** Tour "seen" flag and AI polling run locally (UserDefaults / DataStore), like the web localStorage key `bb:categorize-tour-seen`.
- **Proposal — needs product sign-off:** Logo.dev credit link opens in the system browser.

## Open questions

1. The decision brief mentions a wizard «Categorizza automaticamente» (CLAUDE.md known limitation about Jaccard matching), but no such wizard exists in the current code; the similarity-based proposals (`storico`, rule similarity ≥ 0.5) live inside `/categorizza`. Confirm it is retired and not to be built.
2. Merchant logo endpoints require an authenticated session cookie and are referenced as relative `<img>` URLs; native apps need an authenticated image loader (Bearer/cookie header) or a public signed URL. API gap to resolve.
3. Default-category localisation (`localizeCategory`) happens client-side in the web query layer; native apps must reimplement it (needs the translation catalogue and `LEGACY`/default name table) or the API should return localised names.
4. Server `GET /api/user/ai-categorization` returns `autoApply: false` when the row is missing, while the decision says the option is ON by default for new users (DB default). Confirm the effective default for new mobile signups.
5. Swipe-deck save timing (5 s debounce, client batching) means decisions can be lost if the app is killed; acceptable on mobile or should native save immediately with a server-side undo?
6. `auto-categorized` returns at most 1000 movements of the last 30 days and no pagination. Confirm acceptable.
7. Ricategorizza is synchronous (single request); very large accounts may time out on mobile networks (decision lists "Ricategorizza come job" as deferred).
8. Board ordering within sections is by creation date; there is no user-defined ordering. Confirm mobile should not add reordering.
9. AI generation progress relies on client polling (4 s, ~4 min max) with no server status; if the app is backgrounded the strip state is lost. Confirm acceptable or add a status endpoint.
10. The list-view progress label (`Applicate {x} di {y} transazioni`) and some strings in `categorize-group-row`/`recategorize-row` are hard-coded Italian (not passed through `t()`), so they are untranslated on web; mobile should use catalogue keys.
