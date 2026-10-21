# Savings goals (Obiettivi)

Status: draft · Source: app/(app)/analitiche/layout.tsx, app/(app)/analitiche/obiettivi/page.tsx, app/(app)/analitiche/obiettivi/[id]/page.tsx, components/domain/goals/, components/domain/analytics/analytics-tabs.ts, lib/goals/{constants,plan,view,data,server}.ts, lib/validation/goals.ts, lib/queries/goals.ts, app/api/goals/route.ts, app/api/goals/[id]/route.ts, app/api/goals/reorder/route.ts, lib/notifications/{constants,goals,run}.ts, lib/whats-new/entries.ts

## Purpose

Users name what they are saving for: emergency fund, trip, house, a purchase, something else. For each goal they set:
- how much they need and, optionally, by which month
- which parts of their accounts and investment positions already belong to it. Positions count net of the estimated tax on sale. This is only a label: real balances never change.
- a monthly amount

The monthly savings capacity comes from Analitiche. It goes to goals in priority order. The app tells the user:
- when each goal is reached at today's pace
- whether savings cover all goals
- how far each goal moves the FIRE target («smettere di lavorare»)

Email reminders are opt-in.

## Entry points & navigation

- Analitiche tab `Obiettivi` at `/analitiche/obiettivi`. The tabs are `Risposte` and `Obiettivi`; tab description: `Per cosa metti da parte e quando ci arrivi`. There is no sidebar item of its own.
- Deep links:
  - `/analitiche/obiettivi?nuovo=1`: opens the create form
  - `&tipo={emergenza|viaggio|casa|acquisto|altro}`: presets the kind
  - `&da={panoramica|novita|email}`: tells analytics where the user came from (default `analitiche`)
  - closing the form removes the query (replace, no scroll)
- Detail: `/analitiche/obiettivi/{id}`, with a `BackLink` `‹ Obiettivi`.
- Arrivals:
  - Overview goals section (see 02-overview: OV-030..OV-032)
  - «Novità» entry `Obiettivi di risparmio` → `?nuovo=1&da=novita`
  - goal reminder emails
- The list screen header has:
  - `SectionHeading` `Analitiche`, with subtitle `Per cosa metti da parte, quando ci arrivi e cosa cambia per il traguardo.`
  - the `SectionTabs`
  - a primary button `Nuovo obiettivo` (icon only on phone)
- The detail screen has no section header, only the BackLink.
- The disclaimer is always at the bottom: `Stime a scopo informativo basate su ipotesi tue, non previsioni né consulenza finanziaria o fiscale. Le regole fiscali sono semplificate: verificale prima di decisioni importanti.`
- **Country gating (DE):**
  - `/analitiche` and all its subpaths, including `/analitiche/obiettivi` and `/analitiche/obiettivi/{id}`, render the German `PlanningScreen` (section `retirement`) instead of the goals UI
  - every `/api/goals*` endpoint returns `403 {code:"country_feature_unavailable", error:"Questa funzione non è ancora disponibile per la Germania."}`
  - the Overview goals section, the «Novità» entry and goal emails are suppressed

## Screens

> **Phone layout (Phase 4R, web 0.81.0).** Heading «Obiettivi ⌄» with the yellow `+`; the capacity sentence in the condensed
> display face (32); section titles without icons; no rules between goals. Goal detail: amount as `MoneyHero`, actions as
> wrapping pills with «Elimina» as red text.

### Goals list (`/analitiche/obiettivi`)

- Loading: two skeleton blocks.
- Error: `Impossibile caricare gli obiettivi.` with retry.
- Data: `GET /api/goals` returns the `GoalsView`:
  - `currency`, `todayKey`, `capacity`, `requested`, `allocated`, `gap`
  - `goals[]`, each with its plan row and sources
  - `fire`
  - `sources[]`: free parts of accounts and positions
  - `essentialMonthly`, `essentialBasis` (`dovute` | `tutte` | null; web #382), `debtsTotal`
- Cached 5 minutes. Every goal mutation invalidates it.

**Empty (no goals)**
- EmptyState:
  - title `Dai un nome ai tuoi risparmi`
  - description: `Un viaggio, l'anticipo di casa, un fondo per gli imprevisti: scegli quanto ti serve e da dove arrivano i soldi (conti o investimenti). Ti diciamo quando ci arrivi, se il risparmio basta per tutto e di quanto ogni obiettivo sposta il giorno in cui puoi smettere di lavorare.`
  - primary `Nuovo obiettivo`
- If essential monthly spending is known, an emergency-fund suggestion follows:
  - title `Da dove partire: un fondo di emergenza`
  - body `Con {0} mesi di spese dovute sarebbero circa {1}. Sui conti hai {2} che nessun obiettivo usa ancora.` (0 = 6, 1 = X, 2 = Y; `Con {0} mesi delle tue spese sarebbero circa {1}. Sui conti hai {2} che nessun obiettivo usa ancora.` when `essentialBasis` is `tutte`)
    - X = essentialMonthly × 6, rounded to the nearest 100. Since web #382 `essentialMonthly` is the monthly average of the last 12 months of real expenses (from the first month with spending; the current month only when it is the only one): the `dovute` and `saltuarie` groups, or every expense (`essentialBasis = tutte`) when more than 25% of the spending has no category.
    - Y = sum of the free parts of accounts
  - button `Crea il fondo di emergenza`, which opens the form with kind `emergenza` preset

**With goals: capacity header**
- When capacity is unknown:
  - `Non sappiamo ancora quanto risparmi al mese.`
  - `Servono almeno tre mesi di movimenti, oppure scrivi il tuo risparmio nelle ipotesi delle Risposte. Intanto gli obiettivi tengono il conto di quanto hai già messo da parte.`
- When capacity ≤ 0:
  - `In questo periodo hai speso più di quanto hai incassato.`
  - `Finché resta così gli obiettivi non ricevono niente: contano solo i soldi che hai già messo da parte.`
- Otherwise:
  - `Metti da parte {capacity} al mese.`
  - when requested > 0, a second line: `I tuoi obiettivi ne chiedono {requested}.`
  - an explanation, one of:
    - gap: `… Ne mancano {gap} al mese: {lowest underfunded goal} resta indietro.`
    - leftover with FIRE: `…; i {left} che avanzano vanno verso il traguardo.`
    - leftover without FIRE: `…; ne avanzano {left} al mese.`
    - otherwise: `Il risparmio va agli obiettivi nell'ordine che scegli.`
- A horizontal stacked bar, in priority order:
  - one segment per open goal that receives money, labelled `{name} {amount}`, in the kind colour
  - then the leftover, as `Traguardo` (with FIRE) or `Liberi`
  - then the gap, dashed in red, labelled `−{gap}`
  - the scale runs from 0 to capacity + gap

**`In ordine di priorità` list**
- Contains the open goals: every goal except those explicitly marked achieved. A goal whose money is all assigned but which is not yet marked stays here, labelled `Raggiunto`.
- Hint on wide screens: `Usa le frecce per cambiare l'ordine`.
- Row content:
  - kind icon
  - name (link to the detail)
  - `{current} di {target}`
  - progress bar: amber when late, green when reached, otherwise primary
  - status label, coloured: `Raggiunto` / `In linea` / `In ritardo`. There is no label for «senza data» or «fermo».
  - status sentence (see below)
  - FIRE shift sentence (see below)
  - source chips `{source name} {counted amount}`, each with its icon (web #382): the account's own avatar (colour + icon) or the instrument icon/logo; without data nothing
  - up/down arrows. They are hidden or disabled at the ends and while a reorder is pending.
  - «⋯» menu (a11y `Azioni per {name}`, web #382) with the detail's actions: `Modifica` (form, first step), `Aggiorna i soldi da parte` (form at `fonti`; not for achieved goals), `Segna come raggiunto` / `Riapri`, separator, `Elimina` (same confirmation as the detail).
- Arrows swap a goal with its open neighbour and send the full ordered id list.
  - The list updates optimistically, then refetches.
  - Server 409: `L'elenco degli obiettivi non è aggiornato: ricarica la pagina`.
- Last row (when FIRE data exists): `Smettere di lavorare` → `/analitiche`.
  - Shows `{wealth} di {target}` and a progress bar.
  - Sentence, one of:
    - `Il traguardo delle Analitiche: ci arrivi nel {year}.`
    - `… ci arrivi nel {withGoals} con i tuoi obiettivi, nel {base} senza.`
    - `… al ritmo di oggi non ci arrivi entro 50 anni.`

**`La strada`** (shown only with 2 or more stops)
- The arrival month of each open goal that has an ETA, plus the FIRE year (`Smetti di lavorare`), sorted by date and laid out on a horizontal scrolling line.
- Footnote: `Date al ritmo di oggi, senza contare la crescita degli investimenti assegnati.`

**`Raggiunti`**
- Goals marked achieved, as compact rows.

**Status sentence** (`statusSentence`)
- Reached:
  - marked: `Segnato come raggiunto: non prende più niente dal risparmio del mese.`
  - not marked: `I soldi ci sono tutti: puoi segnarlo come raggiunto.`
- Fermo:
  - no monthly amount: `Nessuna quota al mese: scegline una per sapere quando ci arrivi.`
  - otherwise: `Questo mese il risparmio non arriva fin qui: gli obiettivi più in alto prendono tutto.`
- Otherwise: `Al ritmo di {funded} al mese ci arrivi a {mese anno}`
  - if partially funded, add ` (ricevi {funded} dei {monthly} che hai scelto)`
  - if late with a date, add `, dopo {target month}: servirebbero {required} al mese.`
  - otherwise end with `.`

**FIRE shift sentence**
- Shown only when computable and the goal is not reached:
  - `non sposta il traguardo`
  - `sposta il traguardo di 1 mese` / `di {n} mesi` (under 12 months)
  - `sposta il traguardo di circa {n} anni`
- Emergency-fund goals never shift the target, because their money stays in the user's wealth.

### Goal form: «Nuovo obiettivo» / «Modifica obiettivo» (5 steps, full-screen on phone)

- Header:
  - title `Nuovo obiettivo`, with description `Una cosa per cui mettere da parte: il risparmio del mese la raggiunge nell'ordine che scegli.`
  - or `Modifica obiettivo`, with the goal name as description
- A progress indicator (label `Passi del nuovo obiettivo`).
- Buttons:
  - `Indietro` (from step 2 on)
  - primary: `Avanti` on steps 1–4; `Crea obiettivo` / `Salva` on step 5; `Salvataggio…` while pending
- The primary button is disabled until the step is valid.
- Server errors show above the actions, with the «Segnala questo problema» affordance.
- Steps:
  1. **tipo**: `Che cosa vuoi raggiungere?`
     - Radio cards with label and hint:
       - `Fondo di emergenza`: `Qualche mese di spese da parte per gli imprevisti`
       - `Viaggio`: `Una vacanza o un viaggio da pagare senza debiti`
       - `Casa`: `L'anticipo di una casa o dei lavori`
       - `Un acquisto`: `Un'auto, un computer, un matrimonio`
       - `Qualcos'altro`: `Qualunque cosa per cui vuoi mettere da parte`
     - After a kind is chosen, `Nome` appears (max 80, placeholder `es. Viaggio in Giappone`).
     - Default names are pre-filled when the name is empty or still the previous default: `Fondo di emergenza`, `Viaggio`, `Anticipo casa`; empty for the other kinds.
     - Choosing `emergenza` with no target yet presets 6 months (and the target from essential spending when known; web #382).
     - Valid when: a kind is chosen and the trimmed name is 1–80 characters.
  2. **quanto**
     - Title: `Quanto ti serve, ed entro quando?`, or `Quanti mesi di spese vuoi coprire?` for emergency.
     - Description: `La data è facoltativa: senza, ti diciamo solo quando ci arrivi al ritmo di oggi.`
     - Emergency (web #382):
       - chips `3 mesi` / `6 mesi` / `12 mesi`, each setting the target to months × monthly spending, rounded to 100 (without a spending figure the months stay chosen and the target comes when the user types one)
       - `Spese al mese` currency field, pre-filled with `essentialMonthly` and editable (typing recomputes the target with the chosen months); note: typed by the user or no data → `Scrivi quanto spendi in un mese: la cifra si aggiorna da sola.`; basis `dovute` → `Media delle tue spese dovute e saltuarie degli ultimi mesi (casa, bollette, spesa, rate). Puoi cambiarla.`; basis `tutte` → `Media di tutte le tue uscite degli ultimi mesi: molte non hanno ancora una categoria, quindi è una stima larga. Puoi cambiarla.`
     - `Quanto ti serve`: currency input. Typing clears the chip choice.
     - `Entro quando`:
       - chip `Nessuna data`, or a month picker
       - the minimum month is next month
     - With a date, a note: `Per arrivare a {mese anno} servono {required} al mese.`
       - plus, if capacity is known: ` Metti da parte {capacity} al mese, di cui {taken} già presi dagli altri obiettivi.`
       - required = ceil((target − assigned) / max(1, months until the target month))
     - Valid when: target > 0, and the month is empty or later than the current month.
  3. **fonti**: `Da dove arrivano i soldi?`
     - Description: `Scegli cosa è già per questo obiettivo. Puoi anche partire da zero.`
     - Two groups, `Liquidità` (accounts) and `Investimenti` (positions). Each row shows its name and `{total} · {free} liberi`.
     - Free amounts: in edit mode, this goal's own current parts are added back to free.
     - Accounts or positions with a total ≤ 0 are hidden unless already used by this goal.
     - Tapping a row selects it and proposes an amount: min(free, target − already assigned), or floor(free) if that is 0. The amount stays editable. Tapping again deselects.
     - Empty: `Non hai ancora conti né investimenti: l'obiettivo parte da zero e cresce con la quota del mese.`
     - Note: `Assegnati {assigned} di {target}. Dove li tieni non cambia il saldo dei conti: è solo un'etichetta. Per i titoli contiamo il valore al netto dell'imposta stimata se li vendessi oggi.`
     - Valid when: at most 12 sources, and every selected amount > 0.
  4. **ritmo**: `Quanto ogni mese?`
     - Description: `È la quota del tuo risparmio che va a questo obiettivo. La puoi cambiare quando vuoi.`
     - Suggestion chips:
       - `Quanto serve: {required}`, when a date is set
       - `Quanto avanza: {free capacity}`, when > 0 and different from required
     - `Quota al mese`: currency input, ≥ 0.
     - New goal only, when other goals exist: `Chi riceve per primo il risparmio del mese?`
       - radio options: `Prima di tutti`, `Dopo {name}` for each other goal, and `In fondo, dopo {last}`
       - default: last position
     - Notes:
       - when the assigned money covers the target: `Con i soldi che hai già assegnato l'obiettivo è coperto: la quota può restare a zero.`
       - when the quota exceeds the free capacity: `Oggi ne avanzano {free} al mese: chi sta più in basso nella lista riceverà meno.`
     - Valid when: the quota is ≥ 0, or the goal is already covered (an empty quota is then saved as 0).
  5. **riepilogo**: `Tutto giusto?`
     - Shows the icon and name, then:
       - `Quanto`
       - `Entro` (or `Nessuna data`)
       - `Già da parte` (or `Niente, parti da zero`)
       - `Ogni mese`
     - then `Da: {source amount, …}`
     - **Create only, and only if goal emails are currently off:** checkbox `Ricordamelo per email`, default **checked**.
       - Hint: `A inizio mese a che punto sei, e un avviso quando lo raggiungi o la data si avvicina. Si spegne da Impostazioni o dal link in ogni email.`
       - If checked at submit, the app turns goal emails on (`PATCH /api/user/notifications {goalAlertsEnabled:true}`).
- Submit:
  - Create: `POST /api/goals` with `{name, kind, targetAmount, targetDate|null ("YYYY-MM-01"), monthlyAmount, priority, sources:[{accountId|instrumentId, amount}]}`. On success the form closes and the list refetches.
  - Edit: `PATCH /api/goals/{id}` with the same fields except priority. Sources replace all existing parts. The position is changed only from the list.
- Server validation:
  - name: trimmed, 1–80
  - kind: in the enum
  - targetAmount: > 0 and ≤ 100,000,000
  - monthlyAmount: 0 to 100,000,000
  - targetDate: `YYYY-MM` or `YYYY-MM-DD`, normalized to the 1st of the month
  - priority: 0–100
  - sources:
    - at most 12 (`Al massimo 12 fonti per obiettivo`)
    - each needs exactly one id (`Scegli un conto o un titolo`) and an amount > 0 (`Indica quanto assegnare`)
- Server checks:
  - at most 20 goals: 409 `Puoi avere al massimo 20 obiettivi`
  - every account or instrument must belong to the user; 404 `Conto non trovato` / `Titolo non trovato`
  - no duplicate sources: `Ogni conto o titolo può comparire una volta sola`
  - a new goal at position p pushes the following goals down
- When the same account or position is assigned to several goals, higher-priority goals take from it first. A part that exceeds what is left is capped and flagged as short.

### Goal detail (`/analitiche/obiettivi/{id}`)

- Loading: one skeleton.
- Error: `Impossibile caricare l'obiettivo.` with retry.
- Unknown id:
  - BackLink, then EmptyState `Obiettivo non trovato` / `Forse è stato eliminato.`
  - primary `Torna agli obiettivi`
- Content:
  - icon and name (H1)
  - big animated current amount (masked when amounts are hidden)
  - `di {target} · entro {mese anno}`, or `di {target}` when there is no date
  - progress bar
  - status label with a full stop, then the status sentence
- Section `Da dove arrivano i soldi`:
  - Sources are grouped into Liquidità and Investimenti. Each row shows its name and:
    - account: `{assigned} dei {balance} sul conto`
    - position: `{assigned} dei {value} della posizione · imposta stimata {tax}`
    - plus ` · oggi ne trovi solo una parte` when the part is short
    - the counted amount on the right
  - With no sources: `Nessun conto o titolo assegnato: l'obiettivo cresce solo con la quota del mese, quando aggiorni quanto hai messo da parte.`
  - Tax note, when any tax > 0: `Per i titoli contiamo il valore al netto dell'imposta stimata se vendessi oggi, con l'aliquota del titolo e senza le minusvalenze da compensare: la scheda Tasse fa il calcolo completo.`
- Section `Cosa cambia quando lo raggiungi` (hidden once the goal is reached):
  - `Patrimonio`:
    - emergency kind: `0`, with `i soldi restano tuoi, da parte`
    - otherwise: `−{target}`, with `escono a {ETA month}` or `escono quando lo raggiungi`
  - `Smetti di lavorare`: the FIRE year with all goals, or `—`, plus the shift sentence or `serve sapere spesa e risparmio nelle Risposte`
- Actions:
  - `Aggiorna i soldi da parte` (primary): opens the edit form directly at step 3 (fonti). Back can reach earlier steps; saving PATCHes all fields.
  - `Modifica`: opens the edit form at step 1.
  - `Segna come raggiunto` / `Riapri`: `PATCH {achieved:true|false}`, no confirmation. Marking keeps the original achieved date if one exists.
  - `Elimina`: confirmation dialog:
    - title `Eliminare «{name}»?`
    - body `L'obiettivo sparisce dalla lista. I saldi dei conti e gli investimenti non cambiano: le parti assegnate tornano libere.`
    - buttons `Annulla` / `Elimina` (`Eliminazione…` while pending)
    - errors show inline
    - on success: `DELETE /api/goals/{id}`, then navigate to the list; the remaining goals are renumbered
  - All action buttons are disabled while achieve is pending.

### Email reminders (opt-in)

- Notification kind `goals`, labelled `Promemoria sugli obiettivi`, toggled in Settings → Notifiche. Off by default. It can be turned on from the create form (see step 5).
- A daily cron job sends:
  - a monthly reminder of all open goals, on days 1–3 of the month (Europe/Rome)
  - a `raggiunto` alert for a goal with all its money assigned but not yet marked achieved
  - a `scadenza` alert for a goal whose target month falls within the next 30 days and that is not in line
- Each email is sent at most once (dedup keys per goal and month).
- The periodic digest includes a goals section.
- Skipped for users whose country hides `/analitiche/obiettivi`.

## Requirements

#### Access & gating
- **GOAL-001** The app shall provide the Goals view as the `Obiettivi` tab of Analitiche, at `/analitiche/obiettivi`.
- **GOAL-002** Where the product country is DE, the app shall not show the Goals UI. All Analitiche paths shall show the German planning screen instead, and the app shall treat `403 {code:"country_feature_unavailable"}` from `/api/goals*` as feature unavailable. _API: `GET /api/goals`_
- **GOAL-003** The app shall open the create form when the user arrives with `nuovo=1`, preset the kind from `tipo` when it is valid, and drop these parameters when the form closes.

#### List
- **GOAL-004** The app shall load the goals view once and reuse it for up to 5 minutes, refetching after any goal mutation. _API: `GET /api/goals`_
- **GOAL-005** With no goals, the app shall show the `Dai un nome ai tuoi risparmi` empty state with a `Nuovo obiettivo` action.
- **GOAL-006** (changed by web #382) With no goals and known essential spending, the app shall suggest an emergency fund. The amount shall be 6 months of essential spending (server: last 12 months of real expenses, `dovute`+`saltuarie` or all when too much is uncategorised) rounded to 100, together with the free account money, worded by `essentialBasis`. Its action shall open the form with kind `emergenza`.
- **GOAL-007** The app shall show the capacity header in one of three states: capacity unknown, capacity ≤ 0, or capacity known. In the known state it shall show requested total, gap or leftover sentence, and the stacked allocation bar in priority order.
- **GOAL-008** (changed by web #382) The app shall list the goals not marked achieved under `In ordine di priorità`. Each row shall show current/target, progress, status label, status sentence, FIRE shift sentence and source chips with the account avatar or instrument icon.
- **GOAL-009** The app shall let the user move a goal up or down among the open goals. It shall update the order immediately and persist the full id order. _API: `POST /api/goals/reorder` body `{ids}`_
- **GOAL-010** The app shall show the server message and refetch when a reorder returns 409 (stale list).
- **GOAL-011** When FIRE data exists, the app shall end the priority list with the `Smettere di lavorare` row, linking to `/analitiche`, with the year with and without goals.
- **GOAL-012** The app shall show `La strada` when there are at least 2 stops (open goals with an ETA, plus the FIRE year), ordered by date.
- **GOAL-013** The app shall list goals marked achieved under `Raggiunti`.

#### Form
- **GOAL-014** The app shall create and edit goals through a 5-step form (tipo, quanto, fonti, ritmo, riepilogo), with `Indietro` and a primary button enabled only when the current step is valid.
- **GOAL-015** Step tipo shall require a kind and a trimmed name of 1–80 characters, and shall pre-fill the kind's default name unless the user typed their own.
- **GOAL-016** Step quanto shall require a target > 0 and an optional target month after the current month. It shall show the monthly amount required to arrive on time.
- **GOAL-017** (changed by web #382) For an emergency fund, step quanto shall offer 3/6/12-month choices and an editable `Spese al mese` field (pre-filled from essential spending, with the note by basis); the target is months × spending rounded to 100, and typing a target amount clears the month choice.
- **GOAL-018** Step fonti shall list accounts and positions with their total and free amount, let the user select up to 12 with an amount > 0 each, and propose the amount still missing (capped at free).
- **GOAL-019** In edit mode, step fonti shall count the goal's own current parts as free.
- **GOAL-020** Step ritmo shall accept a monthly amount ≥ 0 (empty allowed only when already covered). It shall offer `Quanto serve` and `Quanto avanza` shortcuts and warn when the amount exceeds the free capacity.
- **GOAL-021** For a new goal with other goals present, step ritmo shall let the user pick the position (first, after each goal, last). The default shall be last.
- **GOAL-022** Step riepilogo shall summarize target, month, already assigned, monthly amount and sources.
- **GOAL-023** When creating a goal while goal emails are off, step riepilogo shall show `Ricordamelo per email`, checked by default. When it is checked at submit, the app shall enable goal emails. _API: `PATCH /api/user/notifications` body `{goalAlertsEnabled:true}`_
- **GOAL-024** The app shall create the goal and close the form on success. _API: `POST /api/goals`_
- **GOAL-025** The app shall save edits, replacing all sources, without changing the position. _API: `PATCH /api/goals/{id}`_
- **GOAL-026** The app shall show server validation errors inline, including the 20-goal limit (409) and unknown source (404).

#### Detail
- **GOAL-027** The app shall show the goal detail with current amount, target and month, progress, status and status sentence. Sources shall be grouped by Liquidità/Investimenti, with estimated tax and a short-part warning.
- **GOAL-028** For goals not yet reached, the app shall show `Cosa cambia quando lo raggiungi`: the wealth impact (none for emergency funds) and the FIRE year with its shift.
- **GOAL-029** `Aggiorna i soldi da parte` shall open the edit form at the fonti step.
- **GOAL-030** `Modifica` shall open the edit form at the first step.
- **GOAL-031** The app shall toggle the achieved state with `Segna come raggiunto` / `Riapri`, without confirmation. _API: `PATCH /api/goals/{id}` body `{achieved}`_
- **GOAL-032** The app shall ask for confirmation before deleting a goal. On success it shall return to the list. _API: `DELETE /api/goals/{id}`_
- **GOAL-033** For an unknown id, the app shall show `Obiettivo non trovato` with `Torna agli obiettivi`.
- **GOAL-034** The app shall apply the «Nascondi importi» mask to all goal amounts.

#### Reminders
- **GOAL-035** The app shall expose the `Promemoria sugli obiettivi` email toggle in notification settings, off by default. _API: `GET /api/user/notifications`, `PATCH /api/user/notifications`_
- **GOAL-036** (web #382) Each open and achieved goal row shall have a «⋯» menu with `Modifica`, `Aggiorna i soldi da parte` (not achieved), `Segna come raggiunto` / `Riapri` and `Elimina`, behaving as the detail's actions (GOAL-029…032).
- **GOAL-037** (web #382) Sources in rows, detail and the fonti step shall show the account's avatar or the instrument's icon (logo when available, with `Loghi forniti da Logo.dev` once shown).

## Mobile adaptation notes

- **Proposal — needs product sign-off:** Reordering. Keep the up/down arrow buttons on each row; do not use drag and drop, which is postponed on web. Each tap sends the full order and updates optimistically.
- **Proposal — needs product sign-off:** The `Nuovo obiettivo` header button becomes a trailing navigation-bar "+" button on the Goals tab. It is the only create entry point besides the empty state and deep links.
- **Proposal — needs product sign-off:** Deep links `…/analitiche/obiettivi?nuovo=1&tipo=…&da=…` (from emails and «Novità») map to native routes. They open the Goals tab and present the create sheet with the preset kind.
- **Proposal — needs product sign-off:** The month picker (`type="month"`) becomes a native month+year wheel/menu with a minimum of next month. `Nessuna data` is a separate chip, as on the web.
- **Proposal — needs product sign-off:** Show `La strada` as a horizontally scrolling row, as on web. Stops are not tappable.
- **Proposal — needs product sign-off:** The allocation bar's `title` tooltips are replaced by tapping the bar. Tapping opens a bottom sheet listing each segment (name and amount), in the same order.
- **Proposal — needs product sign-off:** The 5-step form is a full-screen modal with a step indicator. Swipe-back goes to the previous step and does not dismiss the modal. Closing the modal with unsaved changes discards them without a prompt, as on the web.

## Mobile implementation notes (Phase 4a, 2026-10-19)
- Goals are the «Obiettivi» view of the Analitiche screen (segmented control), the detail is a pushed screen; `+` in the top bar, empty state and deep links (`?nuovo=1&tipo=`, `/analitiche/obiettivi/{id}`) open the 5-step full-screen form. The allocation bar opens a bottom sheet with the segments on tap; reordering uses the up/down arrows.
- The month picker is a native month grid (minimum next month); goal emails are enabled only after a successful create (open question 1). For DE, `/analitiche/obiettivi[/{id}]` shows the country-unavailable screen and nothing in the app links to goals, matching the web (`isCountryPathAvailable`); GOAL-002's «German planning screen» is not built because `retirement` is switched off on the web.

## Open questions

1. The reminder opt-in is fired right after submit, before the create call succeeds. If creation fails, emails are still enabled. Should mobile enable reminders only after a successful create?
2. In step ritmo, `others` includes goals already marked achieved, so position choices can mention reached goals. Is this intended?
3. A goal whose money is all assigned but not marked achieved shows `Raggiunto` while staying in the priority list, with arrows. Confirm this mixed state is intended.
4. Capacity and FIRE data come from the Analitiche snapshot (assumptions, data period). Mobile has no Analitiche «Risposte» screen spec'd here, but the empty-capacity copy points users to «ipotesi delle Risposte». Mobile needs that screen or a different call to action.
5. `Segna come raggiunto` and `Riapri` have no confirmation and no undo. Should mobile add an undo snackbar?
6. The cron that sends goal emails uses Europe/Rome days 1–3. There are no push notifications. Is mobile push in scope?
7. In edit mode the form PATCHes the full payload, so the name, target and other fields are re-sent even when only sources changed («Aggiorna i soldi da parte»). This is harmless, but a concurrent edit elsewhere would be overwritten (last write wins).
8. CLAUDE.md marks this feature «PR in bozza» (migration 0038). It is present in the checkout; confirm it is shipped before mobile implementation.
