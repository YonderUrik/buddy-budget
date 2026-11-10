# Subscriptions (Abbonamenti)

Status: draft · Source: app/(app)/liquidita/abbonamenti/page.tsx, components/domain/subscriptions/, components/domain/liquidity/liquidity-nav.ts, lib/subscriptions/{data,view}.ts, lib/calc/subscriptions.ts, lib/validation/subscriptions.ts, lib/queries/subscriptions.ts, app/api/subscriptions/route.ts, app/api/subscriptions/[id]/route.ts

## Purpose

The app finds recurring charges in the user's expense transactions: same merchant, steady amount, and a weekly, monthly, quarterly, semiannual or annual rhythm. The user confirms the real subscriptions and dismisses the rest. The screen shows:
- the monthly and yearly cost of the confirmed subscriptions
- the next charge
- price rises
- subscriptions that stopped being charged

Users can also add subscriptions by hand, e.g. paid in cash or from an untracked account. Detection is a deterministic calculation on the server, with no AI. It runs on every request.

## Entry points & navigation

- Tab `Abbonamenti` in the Liquidità section at `/liquidita/abbonamenti`. Tab description: `Addebiti ricorrenti, costo al mese e prossimi addebiti`.
- On phone, the Liquidità `SectionHeading` title opens the views sheet; on desktop the tabs are a segmented control.
- This tab is "global": the Liquidità account filter does not apply to it.
- There are no deep links into a single subscription. The detail opens in place as a dialog or sheet.
- Country gating: none. The tab is identical for IT and DE.

## Screens

### Subscriptions screen

- Loading: one skeleton block.
- Error: `Impossibile caricare gli abbonamenti.` with retry.
- The data comes from one call, `GET /api/subscriptions`. It returns:
  - `items` (detected and saved items merged, sorted by next charge date ascending; items with no date come last)
  - `totals`
  - `currency`
  - `today` (the server date, `YYYY-MM-DD`)
- Sections in order:
  1. **Hero** (always)
     - `Gli abbonamenti ti costano ogni mese`
     - a big amount: `totals.monthly`, the sum of the monthly equivalents of confirmed **active** items
     - line 1:
       - if `count > 0`: `{yearly} all'anno, in {n} abbonamento confermato|abbonamenti confermati.`
       - otherwise: `Conferma quelli che riconosci qui sotto e li sommiamo.`
       - if `pendingCount > 0`, append: ` Altri {n} da confermare valgono circa {pendingMonthly} al mese.`
     - line 2 (bell icon), only if there is a confirmed active item due within 30 days (overdue included):
       - `Prossimo addebito: ` **name** ` {when}`
       - plus `· nei prossimi 30 giorni {n} addebiti, {sum}` when there is more than one
     - `{when}` is one of:
       - `oggi`
       - `domani`
       - `tra {n} giorni` (2–14 days)
       - `il {d MMM}`: `l'` before 8 and 11 in Italian; the year is added if the date is more than 300 days away
  2. **Empty block**, only when there are no items at all:
     - title `Ancora nessun abbonamento`
     - body: `Cerchiamo nei tuoi movimenti gli addebiti che tornano con lo stesso importo, ogni settimana, mese, trimestre o anno. Servono almeno tre mesi di movimenti (due anni, per quelli annuali). Se ne hai uno che non compare, aggiungilo a mano.`
  3. **`Trovati nei tuoi movimenti`**: items with decision `da-confermare` and activity `attivo`.
     - Intro: `Addebiti che tornano con regolarità. Conferma solo i veri abbonamenti: non tutto ciò che ricorre lo è.`
     - Each row has quick actions `È un abbonamento` (confirm) and `Non lo è` (exclude).
  4. **`I tuoi abbonamenti`** (always): confirmed and active rows.
     - With none: `Nessun abbonamento confermato.`
     - Button `Aggiungi a mano` opens the add dialog.
  5. **`Non addebitati da un po'`**: items whose activity is `fermo` and whose decision is `confermato` or `da-confermare`.
     - Intro: `Dovevano tornare e non li vediamo più: sono terminati, o te ne sei dimenticato? Se non sono terminati, controlla che il conto sia sincronizzato.`
     - Each row has the quick action `È terminato`.
  6. **`Aumenti di prezzo`**: items with a price increase in the last 365 days, decision neither `escluso` nor `terminato`.
     - Simple rows, not tappable: name, `Da {from} a {to} {dal d MMM}`, and `+{difference}` in red.
  7. **Archive**: two collapsible groups, closed by default and hidden when empty:
     - `Terminati ({n})`
     - `Non sono abbonamenti ({n})`
     - Their rows open the detail.
  8. Merchant-logo credit line, shown only once a remote logo has been displayed.
- Quick actions send `POST /api/subscriptions` with `{origin:"rilevato", key, status, name, amount, cadence, categoryId}`.
  - If the item has no amount or cadence, the quick action opens the detail instead.
  - All quick buttons are disabled while any save is pending.
- Subscription row (tappable; opens the detail):
  - Merchant logo; when there is none, the initial on a colour that is stable per key.
  - Name.
  - Hint line:
    - active with a next date: `{cadence} · prossimo {when}`, or `atteso` instead of `prossimo` when overdue
    - fermo: `Ultimo addebito {il …}, atteso {il …}`, or `{cadence} · non lo vediamo più tra i movimenti` when there is no last charge
    - terminated or excluded: `{cadence} · ultimo addebito {il …}`
    - unknown cadence: `cadenza da definire`
  - Amount, or `—` if unknown.
  - Below the amount:
    - `era {old price}` in red, if the price rose
    - otherwise `{monthly}/mese` for non-monthly cadences
- Cadence labels:
  - `ogni settimana`, `ogni mese`, `ogni 3 mesi`, `ogni 6 mesi`, `ogni anno`
  - In the select they appear capitalized.
- Monthly equivalent factors:
  - weekly ×52/12
  - monthly ×1
  - quarterly ÷3
  - semiannual ÷6
  - annual ÷12

### Subscription detail (dialog; full-screen form on phone)

- Header:
  - icon and the name
  - subtitle: `Aggiunto da te` (manual) or `Trovato nei tuoi movimenti` (detected)
- Top of the body:
  - the amount, large
  - the hint line (same as the row)
  - `Pesa {monthly} al mese`, if the cadence is not monthly
- Section `Perché lo vediamo qui`, only when the item has detection reasons.
  - Description: `Il riconoscimento è un calcolo sui tuoi movimenti, senza AI: la decisione resta tua.`
  - One ticked bullet per reason:
    - `{n} addebiti dello stesso esercente`
    - `Tornano {cadence}`, plus ` (un addebito è saltato, lo abbiamo perdonato)` when one charge was skipped
    - `Importo sempre uguale` / `Importo quasi sempre uguale (differenze minime)`
    - `Il prezzo è passato da {a} a {b} {dal d MMM yyyy}`
    - `Sempre intorno al giorno {d} del mese`
- Section `Ultimi addebiti`: up to 12 most recent charges, newest first, each with date (d MMM yyyy) and amount.
- Section `Modifica`, only when a saved choice exists (`id` not null):
  - `Nome`: required, trimmed, at most 80 characters
  - manual items also have:
    - `Importo`: decimal, locale-formatted, must be > 0, server maximum 100,000
    - `Ogni quanto`: cadence select
    - `Prossimo addebito`: date
  - `Categoria`: a picker over expense categories (income and transfer categories excluded). Placeholder `Nessuna categoria`. It can be cleared.
  - Button `Salva le modifiche` sends `PATCH /api/subscriptions/{id}`.
  - Client errors:
    - `Dai un nome all'abbonamento`
    - `Inserisci l'importo di ogni addebito`
- Footer actions. Left:
  - if a saved choice exists:
    - manual: `Elimina` (trash) sends `DELETE`, which removes the subscription
    - detected: `Ripristina com'era` (undo) sends `DELETE`, which removes the choice so the item returns to «da confermare»
  - The web asks for no confirmation in either case.
- Footer actions. Right, in this order, each conditional:
  - `Non è un abbonamento`: not already excluded, and not manual
  - `È terminato`: not already terminated, and (decision is not `da-confermare`, or the item is `fermo`)
  - `Sì, è un abbonamento`, or `Rimettilo tra i miei` if excluded or terminated: not already confirmed
- A decision on an item with an `id` sends `PATCH {status}`. Without an `id` it sends `POST` with origin `rilevato`. If amount or cadence is missing, the client shows `Mancano importo e cadenza`.
- On success the dialog closes and the list refetches. Errors show inline (server message).

### Add subscription (dialog; full-screen form on phone)

- Title `Aggiungi un abbonamento`.
- Description: `Se compare tra i movimenti lo collegheremo da soli e ne seguiremo gli addebiti.`
- Fields:
  - `Nome`: placeholder `Es. Palestra, Assicurazione casa`, max 80, required
  - `Importo di ogni addebito`: decimal, > 0
  - `Ogni quanto`: default `Ogni mese`
  - `Prossimo addebito`: date, defaults to the server's `today`
  - `Categoria`: optional
- Submit `Aggiungi`. While busy it reads `Salvo…`.
- Sends `POST /api/subscriptions` with `{origin:"manuale", name, amount, cadence, nextDate, categoryId|null}`.
- Server-side outcomes:
  - the name is turned into a key; 400 `Il nome non è valido` if the key is empty
  - 409 `Hai già un abbonamento con questo nome` if the key exists
  - the category must belong to the user (404 `Categoria non trovata`)
  - on success the item is created as `confermato`, `manuale`
- Errors show with the «Segnala questo problema» report affordance.
- A manual item's next date rolls forward automatically by its cadence, until it is no further in the past than the cadence's grace period.
  - Grace days: weekly 3, monthly 7, quarterly 14, semiannual 21, annual 30.
- Manual items are always `attivo`.

### Data rules visible to the user

- Detection looks back 26 months over expense transactions (amount < 0). It ignores categories of type `futuro` (savings/investments group), `entrata` and `trasferimento`.
- Minimum occurrences: weekly 5, monthly 3, quarterly 3, semiannual 3, annual 2.
- A detected item becomes `fermo` when its expected charge is overdue by more than the cadence's grace days.
- Totals exclude pending (`da-confermare`), stopped, terminated and excluded items. Pending items are summed separately.
- A saved choice is keyed by the detection key. The name, category and status stored by the user override the detected values.
- A saved detected item that is no longer detected stays visible as `fermo`, with no charges.

## Requirements

#### List
- **SUB-001** The app shall load the subscriptions view from the server and use the server's `today` for all relative dates. _API: `GET /api/subscriptions`_
- **SUB-002** The app shall show as headline the monthly total of confirmed active subscriptions, with the yearly total and the count of confirmed items.
- **SUB-003** The app shall show `Conferma quelli che riconosci qui sotto e li sommiamo.` when no subscription is confirmed.
- **SUB-004** The app shall show the count and approximate monthly value of pending (to-confirm) items when there are any.
- **SUB-005** The app shall show the next charge among confirmed active items due within 30 days (overdue included). When more than one is due in that window, it shall also show their count and sum.
- **SUB-006** The app shall phrase relative dates as `oggi`, `domani`, `tra {n} giorni` (up to 14), or a short date, adding the year when the date is more than 300 days away.
- **SUB-007** The app shall show the `Ancora nessun abbonamento` explanation when there are no items at all.
- **SUB-008** The app shall list pending active items under `Trovati nei tuoi movimenti`, with quick actions `È un abbonamento` and `Non lo è`. _API: `POST /api/subscriptions`_
- **SUB-009** The app shall list confirmed active items under `I tuoi abbonamenti`, showing `Nessun abbonamento confermato.` when there are none, always followed by the `Aggiungi a mano` action.
- **SUB-010** The app shall list stopped (`fermo`) items that are confirmed or pending under `Non addebitati da un po'`, with the quick action `È terminato`. _API: `POST /api/subscriptions`, `PATCH /api/subscriptions/{id}`_
- **SUB-011** The app shall list price increases from the last 365 days for items that are neither excluded nor terminated, showing old price, new price, the start date and the difference.
- **SUB-012** The app shall show `Terminati` and `Non sono abbonamenti` as collapsible groups, collapsed by default and hidden when empty.
- **SUB-013** When the item lacks an amount or cadence, a quick action shall open the detail instead of saving.
- **SUB-014** Each row shall show the logo or a coloured initial, the name, the cadence/next-charge hint, the amount, and either the previous price (after a rise) or the monthly equivalent (for non-monthly cadences).
- **SUB-015** The app shall disable all quick-action buttons while a save is in progress, and refetch the list after any successful mutation.
- **SUB-027** (web #453) A quick decision (`È un abbonamento`, `Non lo è`, `È terminato`) that the server refuses shall show the server's message as an error toast instead of failing silently; the server shortens a detected name longer than 80 characters (the bank description of the last charge) to 80 instead of rejecting it, and accepts keys up to 1000 characters. _API: `POST /api/subscriptions`_

#### Detail
- **SUB-016** Tapping a row shall open the detail. The detail shall show the amount, hint and monthly weight, the detection reasons (when present), and up to 12 most recent charges, newest first. Each charge opens the movement detail (TX-064, web #455).
- **SUB-017** The app shall show only the decision actions allowed for the current state (see the Screens rules for `Non è un abbonamento`, `È terminato`, `Sì, è un abbonamento` / `Rimettilo tra i miei`).
- **SUB-018** The app shall save a decision with `PATCH` when a saved choice exists, otherwise with `POST` with origin `rilevato`. _API: `PATCH /api/subscriptions/{id}`, `POST /api/subscriptions`_
- **SUB-019** For saved items the app shall allow editing the name (1–80 chars) and the category. For manual items it shall also allow editing the amount (> 0), cadence and next charge date. _API: `PATCH /api/subscriptions/{id}`_
- **SUB-020** The app shall offer `Ripristina com'era` on saved detected items, which resets them to pending. _API: `DELETE /api/subscriptions/{id}`_
- **SUB-021** The app shall offer `Elimina` on manual items, which removes them. _API: `DELETE /api/subscriptions/{id}`_
- **SUB-022** The app shall show server error messages inline in the detail.

#### Add
- **SUB-023** The app shall let the user add a subscription with name (required, ≤ 80), amount per charge (> 0, ≤ 100,000), cadence (default monthly), next charge date (default today) and an optional expense category. _API: `POST /api/subscriptions` body `{origin:"manuale",…}`_
- **SUB-024** The app shall show the server's 409 message `Hai già un abbonamento con questo nome` when a subscription with the same name already exists.
- **SUB-025** The category picker shall exclude income and transfer categories. _API: `GET /api/categories`_
- **SUB-026** The app shall treat manual subscriptions as confirmed and active, rolling their next charge date forward by cadence once it is past the grace period.

## Mobile adaptation notes

- **Proposal — needs product sign-off:** Archive groups use a native disclosure row (chevron) instead of HTML `<details>`, collapsed by default, with the count in the title.
- **Proposal — needs product sign-off:** Quick actions on pending and stopped rows stay as visible buttons under the row, as on web. Swipe actions are not added, so the behaviour is identical on both platforms.
- **Proposal — needs product sign-off:** `Elimina` (manual) and `Ripristina com'era` have no confirmation on web. On mobile, perform them immediately and show an undo snackbar for 5 seconds. Undo re-creates the item with POST (manual) or re-POSTs the previous status (detected).
- **Proposal — needs product sign-off:** The cadence picker is a native menu/picker. The date uses the native date picker, defaulting to the server `today`.
- **Proposal — needs product sign-off:** The detail opens as a full-screen sheet with the decision actions pinned at the bottom; the edit section scrolls above them.
- **Proposal — needs product sign-off:** Merchant logos are served from the app's own server (`logoPath`). Mobile shows the coloured-initial fallback while loading or on failure, and shows the logo credit line under the list once any remote logo has rendered.

## Open questions

1. The page-level error string `Impossibile caricare gli abbonamenti.` is not passed through `t()` on web. The fallback dialog title `Abbonamento` is also untranslated. Should mobile translate both?
2. The hero line is built by concatenating translated fragments (`Altri`, `da confermare valgono circa`, `al mese.`). This does not translate well to German. Mobile should use whole-sentence keys; the catalog needs new entries.
3. The detail exposes no confirmation for destructive actions (delete or restore). Is the undo proposal acceptable?
4. `today` is computed on the server in UTC (`toISOString().slice(0,10)`), so around midnight in Europe it may be yesterday. Should mobile keep using the server value?
5. Detection runs on every GET and reads 26 months of transactions. On mobile, how often should it be refetched (pull-to-refresh only, or on each tab open)? There is no cache hint server-side.
6. The quick-action save sends the detected name, amount and cadence. A later rename via PATCH is kept even if detection changes. If a user edits the name of a detected item, does a new detection key ever orphan it? The key is based on the merchant.
7. CLAUDE.md lists email or push alerts for upcoming charges as postponed. Mobile push for subscriptions is out of scope unless decided otherwise.
