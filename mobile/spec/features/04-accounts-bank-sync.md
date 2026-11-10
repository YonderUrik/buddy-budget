# Accounts & Bank Sync — Liquidità · Conti
Status: draft · Source: `app/(app)/liquidita/conti/page.tsx`, `app/(app)/conti/collega/[connectionId]/page.tsx`, `components/domain/liquidity/{add-account-dialog,account-line,liquidity-shell,account-chips}.tsx`, `components/domain/accounts/*`, `components/domain/sync/*`, `lib/gocardless/*`, `lib/sync-jobs/*`, `lib/validation/accounts.ts`, `lib/validation/gocardless.ts`, `lib/queries/accounts.ts`, `lib/queries/gocardless.ts`, `lib/queries/sync-jobs.ts`, `app/api/accounts/**`, `app/api/gocardless/**`, `app/api/sync-jobs/**`, `app/api/cron/gocardless-sync`, `docs/decisioni/2026-10-11-limite-collegamenti-bancari.md`, `docs/decisioni/2026-10-09-liquidita-flussi-di-aggiunta.md`

## Purpose
Let the user hold cash accounts in two ways: **manual accounts** (name, type, balance kept by the user) and **bank-linked accounts** via Open Banking (GoCardless Bank Account Data, read-only consent, 90 days) whose balance and movements sync automatically and on demand. The Conti tab lists accounts by bank, shows their status, and hosts renewal of expiring consents. Bank-link capacity is limited (one bank per person, 40 new banks app-wide, 3 consents per person per 31 days). Long-running imports/syncs run as background jobs with visible progress (global progress indicator documented in 00-app-shell-navigation). Amounts use the user's base currency and obey «Nascondi importi».

## Entry points & navigation
- Liquidità tab `Conti` (`/liquidita/conti`); legacy `/conti` → `/liquidita/conti` (permanent redirect).
- New-account dialog opens from: Liquidità `Aggiungi` → `Un conto o una banca`; `+ Conto` chip in Movimenti; Conti `Aggiungi un conto` / empty-state primary; Add-transaction dialog `Aggiungi un conto` (see 03); Primi passi link `/liquidita/conti?nuovo=1` (opens the dialog once, then removes the parameter).
- Renewal flow opens from: Conti renewal banner `Rinnova`; account detail `Riconnetti la banca`; `?rinnova=1` (consent emails), `?rinnova=panoramica` (Panoramica banner), `?rinnova=sidebar` (sidebar deadlines). The parameter is consumed once and removed from the URL.
- Bank consent return: GoCardless redirects to `GET /api/gocardless/callback?ref=<connectionId>` which redirects to `/conti/collega/<connectionId>` (account selection, BackLink `‹ Conti`) or to `/liquidita/conti?bankError=<code>`.
- Account rows link to Movimenti filtered by account (`/liquidita?conto=<id>`, see 03).

## Screens

### 1. Conti tab (`/liquidita/conti`)
Data: `GET /api/accounts` (ordered by creation), `GET /api/gocardless/connections` (per linked account: connection, bank name, status, consent expiry, last sync, sync eligibility), `GET /api/sync-jobs`, `GET /api/transactions?from=<today−30d>&to=<today>&type=tutte` (sparklines).
- **Renewal banner** (only if some connection needs renewal), one line per connection, expired/error first, then expiring:
  - expiring (≤7 days left): `Il collegamento con {banca} scade domani.` / `… scade tra {n} giorni.`
  - error: `Il collegamento con {banca} non è andato a buon fine.`
  - expired: `Il collegamento con {banca} è scaduto: i conti non si aggiornano.`
  - Button `Rinnova` → opens New-account dialog directly in renewal mode.
- **Groups**: one section per bank (alphabetical; unknown bank name → `Banca collegata`), hint `Si aggiorna da solo`; then `Manuali` with hint `Li aggiorni tu`. Each header shows the group's balance sum.
- **Account row** (`AccountLine`): avatar (icon + colour), name, type, status text with tone, 30-day balance sparkline (linked accounts, wide screens only), balance (negative in neg colour). Tap → Account detail. Secondary button (a11y `Vedi i movimenti di {nome}`) → Movimenti filtered on that account.
  - Status text: manual → `Aggiornato da te`; link needs renewal → `Da riconnettere` (warning); a running sync job includes it → `Sincronizzazione in corso` (progress, spinner); never synced → `Mai sincronizzato`; else `Aggiornato {tempo relativo}`.
- After the list: button `Aggiungi un conto`.
- **Empty state** (no accounts): title `Nessun conto ancora`, text `Collega la banca o aggiungi un conto a mano: bastano un nome e il saldo.`, primary `Aggiungi il primo conto` (New-account dialog), secondary `Importa un file` (`/importazioni`).
- Error: `Impossibile caricare i conti.` + retry. Loading: busy state.

### 2. New-account dialog («Nuovo conto»; full-screen on phone)
Three views; header icon/title/description per view.
- **2a. Choice** (`Nuovo conto` — `Come vuoi tenere aggiornato questo conto?`):
  - `Collega la tua banca` with badge `Automatico`: `Saldi e movimenti si aggiornano da soli, in sola lettura.` → bank view.
    - Capacity check `GET /api/gocardless/capacity` (`canConnectNew`, `reason`). When blocked the option is disabled (no chevron, neutral badge):
      - `global_limit` / `provider_limit`: badge `In arrivo` — `I posti per il collegamento automatico sono finiti, ne stiamo aggiungendo altri. Intanto usa un conto manuale o importa l'estratto conto.`
      - `user_limit`: badge `Una per persona` — `Per ora si collega una sola banca per persona. Per gli altri conti usa un conto manuale o importa l'estratto conto.`
      - `user_attempts`: badge `Più avanti` — `Hai avviato troppi collegamenti questo mese, riprova più avanti. Intanto usa un conto manuale o importa l'estratto conto.`
  - `Conto manuale`: `Per contanti, carte prepagate o banche che non si collegano.` → manual view.
  - `Importa un file CSV o Excel`: `Carica l'estratto conto: lo leggiamo e crei il conto con i suoi movimenti.` → closes and navigates to `/importazioni`.
- **2b. Bank view** (`Collega la tua banca` — `Scegli la banca: saldi e movimenti arrivano da soli.`; in renewal mode title `Rinnova il collegamento`, description `Scegli di nuovo la tua banca per rinnovare il consenso.`, capacity check skipped — server decides). Link `Cambia modo` → back to choice.
  - Info note: `Ti porto sul sito della tua banca per dare il consenso. Il collegamento è in sola lettura: BuddyBudget non vede le tue credenziali e non può muovere denaro.` + link `Come funziona` (public security page, external browser).
  - `Paese` select with flags: `Italia` (IT), `Germania` (DE), `Francia` (FR), `Spagna` (ES), `Regno Unito` (GB). **Default = the user's product country** (IT or DE). Changing country clears the search.
  - `Cerca la tua banca` (placeholder `Es. Intesa, Fineco, N26`): case-insensitive substring on institution name, client-side over `GET /api/gocardless/institutions?country=XX`.
  - Result count `1 banca` / `{n} banche`; list rows: logo (fallback generic bank icon if missing/broken), name, history `Storico fino a {n} giorni` or `Storico fino a 1 anno|{n} anni` (≥365 days; omitted if invalid).
  - States: loading → 5 skeleton rows (`Caricamento delle banche`); error → `Non riesco a caricare l'elenco delle banche.` / `Succede se la connessione cade o il servizio è occupato. Non hai perso nulla.` + `Riprova` + report link; no match → `Nessuna banca trovata per «{q}».` or `Nessuna banca disponibile in questo paese.` + `Controlla il nome o cambia paese.` + ` Se non c'è, puoi tenere il conto a mano e importare i movimenti da un file.` + `Aggiungi un conto manuale` (→ manual view).
  - Selecting a bank: all inputs disabled, spinner on the row, status `Ti porto sul sito di {banca}…`; `POST /api/gocardless/connections {institutionId, institutionName, transactionTotalDays}` → `{link}`; the app opens the bank consent URL. Errors re-enable the list and show the message with report affordance:
    - 409 capacity (`reason`): `Per ora puoi collegare una sola banca. Gli altri conti puoi tenerli a mano o importarli da un file.` / `Hai avviato troppi collegamenti questo mese. Riprova più avanti, oppure tieni il conto a mano o importa un file.` / `I collegamenti automatici sono al completo: stiamo aggiungendo posti. Intanto puoi tenere il conto a mano o importare un file.`
    - 502 `Impossibile avviare il collegamento con la banca`; 409 demo active `Stai esplorando i dati d'esempio: azzerali per aggiungere i tuoi.`
  - A bank the user already has linked counts as **renewal**: not limited by "one bank per person", may use the reserve up to the provider limit (50), still counts toward the 3-per-31-days attempts.
- **2c. Manual view** (`Conto manuale` — `Aggiorni tu saldo e movimenti, quando vuoi.`), two steps with progress (`Passi del nuovo conto`):
  - Step 1 `Come si chiama il conto?`: `Nome del conto` (placeholder `Es. Conto Intesa`, max 80 chars, required → `Dai un nome al conto, per riconoscerlo nell'elenco.`); `Tipo` select: `Conto corrente` (default), `Conto risparmio`, `Conto deposito`, `Contanti`, `Altro…` (shows free text, placeholder `Es. Cassa contanti, Wallet crypto`, required → `Scrivi di che tipo di conto si tratta.`). `Indietro` on step 1 returns to the choice view.
  - Step 2 `Quanto c'è sul conto oggi?` (`Da qui in poi lo aggiornano i movimenti che registri.`): `Saldo di oggi` currency input (default 0, may be negative; required → `Inserisci il saldo di oggi (anche 0).`); appearance preview with avatar (default colour `slate`, icon `wallet`) — tapping opens the icon/colour picker (`Tocca l'icona per cambiare icona e colore (facoltativo).`).
  - Submit `Aggiungi il conto` (`Aggiungo il conto…`) → `POST /api/accounts`; success closes the dialog. Error shown with report affordance (incl. 409 demo active).
- **Icon/colour picker**: sections `Colore` (app swatch palette, a11y `Colore {nome}`) and `Icona` (30 icons: wallet, credit-card, banknote, building-2, piggy-bank, trending-up, home, car, plane, shopping-cart, briefcase, dollar-sign, bitcoin, landmark, coins, receipt, package, gift, heart, star, zap, coffee, shopping-bag, user, globe, smartphone, watch, graduation-cap, flame, music).

### 3. Bank account selection (`/conti/collega/{connectionId}`, after consent)
- Reached via callback: if consent status ≠ linked → connection marked `error`, redirect `/liquidita/conti?bankError=consent_failed`; missing ref → `missing_ref`; unknown/other user's ref → `not_found`; GoCardless failure → `gocardless_unavailable`. On success the consent expiry is set to now + 90 days.
- Data `GET /api/gocardless/connections/{id}/accounts` → `externalAccounts[{externalAccountId, details{iban,name,product}}]`, `existingAutoAccounts[{id,name}]`.
- Title `Conti trovati`, text `Seleziona quali conti importare. Puoi crearne di nuovi o ricollegarli a un conto già esistente.`
- One card per bank account: checkbox (default unchecked) with name (fallback IBAN, then id) and IBAN; target select: `Crea nuovo conto` (default) or `Ricollega a "{nome}"` for each existing linked account (used for renewals so history and settings are kept).
- `Conferma` (`Avvio…`): requires ≥1 selection (`Seleziona almeno un conto da importare`). `POST /api/gocardless/connections/{id}/finalize {selections:[{externalAccountId,name,type:"Conto corrente",mode:new|existing,existingAccountId?}]}` → 201 `{jobId}`; app navigates to `/liquidita/conti`; import runs as a background job (§5).
- States: loading `Caricamento conti trovati…`; error `Impossibile caricare i conti trovati.`; none shared `La banca non ha condiviso nessun conto. Riprova il collegamento se pensi sia un errore.`
- Server errors: 400 not-owned external account `Conto non appartenente a questa connessione`; 404 `Conto non trovato`; 502 `Banca non raggiungibile, riprova tra poco`; 503 `Servizio temporaneamente non disponibile. Riprova tra poco.` Re-linking moves the account to the new connection; an old connection left without accounts is released immediately.

### 4. Account detail dialog (full-screen on phone)
- Header: avatar (tap → icon/colour picker, SR `Cambia icona e colore`, saves immediately), name, `Collegato alla banca` / `Conto manuale` · status text.
- `Nome`: editable for both kinds, saved on blur (empty or unchanged → reverts, no request).
- Manual: `Tipo` select (same options + `Altro…` free text, saved on change/blur, ignored if empty); `Saldo` currency input saved on blur if changed, hint `Lo aggiorni tu: si salva quando esci dal campo.`
- Linked: read-only `Tipo` and `Saldo dalla banca`; sync box with availability sentence and buttons:
  - Sentence: `Sincronizzazione in corso.` / `Riconnetti la banca per sincronizzare.` / `Informazioni di sincronizzazione non disponibili.` / `Puoi sincronizzare adesso.` / `Sincronizzazione non disponibile.` / `Hai raggiunto il limite di 4 sincronizzazioni al giorno. Prossima alle {HH:MM}.` / `Prossima sincronizzazione disponibile alle {HH:MM}.`
  - `Sincronizza ora` (spinning icon while starting/running), disabled when not eligible, starting, running, or needing reconnect → `POST /api/gocardless/accounts/{accountId}/sync`.
  - `Riconnetti la banca` (only when renewal needed) → renewal flow.
- `Vedi i movimenti di questo conto` → `/liquidita?conto={id}`.
- Destructive: `Elimina il conto` (manual) / `Scollega il conto` (linked) → confirmation:
  - Manual: `Eliminare questo conto?` — `"{nome}" verrà eliminato definitivamente, insieme al suo saldo registrato.` — `Annulla` / `Elimina`.
  - Linked: `Scollegare questo conto?` — `"{nome}" verrà scollegato. L'azione non è reversibile.` — `Annulla` / `Scollega`.
  - `DELETE /api/accounts/{id}` deletes the account **and all its movements**; if it was the last account of a bank connection, the consent is revoked at GoCardless and the slot freed immediately (fallback: daily cleanup). Dialog closes optimistically.
- Server `PATCH /api/accounts/{id}`: name/type non-empty trimmed, balance number, colour/icon from enums, at least one field; for linked accounts type/balance → 403.

### 5. Background sync & import jobs (user-facing)
- Two job kinds: `initial-import` (after Conti trovati; all selected accounts in parallel) and `manual-sync` (one account).
- Per-account phases and texts: `queued` `In attesa`; `balance` `Aggiorno il saldo…`; `fetching` `Scarico i movimenti dalla banca…`; `saving` `Importati {x} di {n} movimento|movimenti` (determinate bar); `done` summary `Nessuna nuova transazione trovata. Saldo aggiornato.` or `{n} nuova transazione|nuove transazioni ({k} categorizzata da sola|categorizzate da sole, {u} da decidere). Saldo aggiornato.`; `limited` `La banca ha temporaneamente esaurito le chiamate disponibili. Riprova più tardi.`; `expired` `Sessione con la banca scaduta. Riconnetti il conto per sincronizzare.`; `error` `Sincronizzazione non riuscita. Riprova più tardi.` / already running `Sincronizzazione già in corso per questo conto.` / interrupted `Sincronizzazione interrotta. I movimenti già salvati restano, il prossimo sync riprende da lì.`
- Job titles: `Sincronizzazione in corso · {n} conto|conti`, `Sincronizzazione completata`, `Sincronizzazione non riuscita`, `Sincronizzazione interrotta`. A running job with no heartbeat for >60 s is shown as interrupted. Completed jobs with uncategorized movements offer `Categorizza` → `/categorizza`. Dismiss (`Chiudi riepilogo`) only when finished, persisted server-side (hidden on all devices). Jobs live 24 h.
- Client polls `GET /api/sync-jobs` every 1 s only while a job is running; when a job finishes it refreshes accounts, connections, net-worth snapshots, transactions and categorization/attention data.
- Manual sync immediate errors (toast with report affordance): 429 not eligible `Hai raggiunto il limite giornaliero di sync. Prossimo disponibile alle {HH:MM}.` (or `Sync non disponibile al momento. Riprova più tardi.`); 409 already running; 503 unavailable `Servizio di sincronizzazione temporaneamente non disponibile. Riprova tra poco.`; 404 `Conto non trovato o non collegato`; other `Impossibile completare la sincronizzazione. Riprova più tardi.`
- What a sync does: updates balance from the bank; downloads the bank's transaction window; de-duplicates by bank transaction id; extracts merchant names; applies the user's rules (including rule-defined split); then, if some remain uncategorized, runs the automatic categorization pass (AI suggestions ≥90% auto-applied if the user enabled it, see 05); records the sync time. A bank 401 marks the connection `expired`.
- Sync budget (shared by manual and automatic syncs, per account): max 4 per rolling 24 h and min 4 h between syncs. Automatic sync runs from a server cron (every 12 h in the self-host compose) for linked connections of non-deactivated users.

### 6. Consent lifecycle (server-driven, user-visible)
- Consent valid 90 days from when the user gives it. Health: `ok`, `expiring` (≤7 days), `expired` (past date or marked by sync/cron), `error` (consent failed), `pending` (not completed). `expiring|expired|error` → renewal proposed (banner, chip warning, row status, Panoramica/sidebar).
- Emails (once per connection and phase): expiring 7 days before (`Il collegamento con {banca} sta per scadere`) and expired (`Il collegamento con {banca} è scaduto`, sent up to 30 days after expiry), CTA `Rinnova il collegamento` → `/liquidita/conti?rinnova=1`.
- Daily maintenance (no UI): marks expired connections; cleans abandoned attempts (3 days), connections without accounts (7 days), long-expired connections (30 days). Data already imported stays.

## Requirements

#### Conti list
- **ACC-001** The Conti tab shall list accounts grouped by bank (alphabetical, unknown → `Banca collegata`) followed by `Manuali`, each group with its balance sum and hint. _API: `GET /api/accounts`, `GET /api/gocardless/connections`_
- **ACC-002** Each account row shall show avatar, name, type, status text, balance and a shortcut to its movements.
- **ACC-003** Account status shall be `Aggiornato da te` (manual), `Da riconnettere`, `Sincronizzazione in corso`, `Mai sincronizzato` or `Aggiornato {relativo}`, in this precedence. _API: `GET /api/sync-jobs`_
- **ACC-004** Linked account rows shall show a 30-day balance sparkline reconstructed from current balance and movements. _API: `GET /api/transactions?from=&to=&type=tutte`_
- **ACC-005** With no accounts, the tab shall show the `Nessun conto ancora` empty state with `Aggiungi il primo conto` and `Importa un file`.
- **ACC-006** On load failure the tab shall show `Impossibile caricare i conti.` with retry.
- **ACC-007** The app shall show a renewal banner with one sentence per connection needing renewal (expired/error first) and a `Rinnova` button opening the renewal flow.
- **ACC-008** A connection shall need renewal when its consent expires within 7 days, has expired, or is in error.
- **ACC-009** Opening Liquidità with `rinnova=<origin>` shall open the renewal flow once and remove the parameter.
- **ACC-010** Opening Conti with the new-account parameter shall open the New-account dialog once and remove the parameter.

#### New account — choice & capacity
- **ACC-011** The New-account dialog shall start with three options: `Collega la tua banca`, `Conto manuale`, `Importa un file CSV o Excel` (→ imports).
- **ACC-012** The app shall query bank capacity when opening the dialog in non-renewal mode. _API: `GET /api/gocardless/capacity`_
- **ACC-013** When `canConnectNew` is false the bank option shall be disabled with the badge and text for its `reason` (`In arrivo`, `Una per persona`, `Più avanti`).
- **ACC-014** In renewal mode the dialog shall open directly on the bank view with renewal copy and without the client capacity check.
- **ACC-015** The server shall allow at most 1 distinct linked bank per user for new connections, 3 consent attempts per user per 31 days, 40 app-wide slots for new banks and 50 including renewals; blocked requests return 409 with `reason` and message. _API: `POST /api/gocardless/connections`_

#### New account — bank link
- **ACC-016** The bank view shall show the read-only/consent explanation with a `Come funziona` link.
- **ACC-017** The country selector shall offer IT, DE, FR, ES, GB and default to the user's product country.
- **ACC-018** The app shall load institutions for the selected country and filter them locally by name. _API: `GET /api/gocardless/institutions?country=XX`_
- **ACC-019** Each institution shall show logo (generic fallback), name and available history in days or years.
- **ACC-020** The bank list shall show loading skeleton, error with `Riprova`, and no-result guidance with `Aggiungi un conto manuale`.
- **ACC-021** Selecting a bank shall disable the list, show `Ti porto sul sito di {banca}…`, create the connection and open the returned consent link. _API: `POST /api/gocardless/connections`_
- **ACC-022** A failure to start the connection shall re-enable the list and show the server message with a report option.

#### Consent return & account selection
- **ACC-023** On consent return the app shall show `Conti trovati` with one selectable card per shared bank account (name or IBAN). _API: `GET /api/gocardless/connections/{id}/accounts`_
- **ACC-024** Each card shall let the user choose `Crea nuovo conto` (default) or `Ricollega a "{nome}"` for an existing linked account.
- **ACC-025** Confirming with no selection shall show `Seleziona almeno un conto da importare`.
- **ACC-026** Confirming shall finalize the selection, start the initial import job and return to Conti. _API: `POST /api/gocardless/connections/{id}/finalize`_
- **ACC-027** A failed consent or callback error shall land the user on Conti (with a `bankError` code) instead of an error page. _API: `GET /api/gocardless/callback?ref=`_
- **ACC-028** The selection screen shall show the loading, error and `La banca non ha condiviso nessun conto…` states.

#### Manual account
- **ACC-029** The manual-account form shall have two steps: name (required, ≤80) and type (preset or `Altro…` free text, required); then today's balance (required, may be 0 or negative) and optional icon/colour (default `wallet`/`slate`).
- **ACC-030** Creating a manual account shall send name, type, balance, colour and icon. _API: `POST /api/accounts`_
- **ACC-031** While demo data is active, account creation and bank connection shall fail with 409 and the message shall be shown.

#### Account detail
- **ACC-032** The detail view shall let the user rename any account, saving on field exit only when changed and non-empty. _API: `PATCH /api/accounts/{id}`_
- **ACC-033** The detail view shall let the user change icon and colour of any account, saving immediately.
- **ACC-034** For manual accounts the detail view shall allow editing type and balance, saving on change/exit.
- **ACC-035** For linked accounts type and balance shall be read-only; the server shall reject changes with 403.
- **ACC-036** For linked accounts the detail view shall show the sync availability sentence including next available time and the daily limit of 4.
- **ACC-037** `Sincronizza ora` shall be disabled when not eligible, already starting/running, or the link needs renewal. _API: `POST /api/gocardless/accounts/{accountId}/sync`_
- **ACC-038** When renewal is needed the detail view shall offer `Riconnetti la banca`.
- **ACC-039** The detail view shall offer `Vedi i movimenti di questo conto` opening Movimenti filtered on it.
- **ACC-040** Deleting a manual account shall require confirmation `Eliminare questo conto?`; unlinking a linked account shall require `Scollegare questo conto?`. _API: `DELETE /api/accounts/{id}`_
- **ACC-041** Deleting/unlinking shall remove the account and all its movements, and when it was the last account of a connection the server shall revoke the consent and free the slot.
- **ACC-042** After delete/unlink the app shall refresh accounts and bank capacity.

#### Sync jobs
- **ACC-043** A manual sync shall start a background job and return immediately; progress appears in the global sync indicator (see 00). _API: `POST /api/gocardless/accounts/{accountId}/sync`_
- **ACC-044** Manual sync errors 429/409/503/404 shall be shown as a toast with the specified messages.
- **ACC-045** The server shall allow a sync (manual or automatic) only if fewer than 4 syncs happened in the last 24 h and at least 4 h passed since the last one.
- **ACC-046** The client shall poll jobs every 1 s while any job is running, and stop otherwise. _API: `GET /api/sync-jobs`_
- **ACC-047** Each job account shall display its phase text, with a determinate bar during saving and the final summary or error.
- **ACC-048** A running job without updates for more than 60 s shall be shown as interrupted.
- **ACC-049** A finished job shall be dismissable, and dismissal shall persist across devices. _API: `POST /api/sync-jobs/{id}/dismiss`_
- **ACC-050** A finished job with uncategorized movements shall offer `Categorizza`.
- **ACC-051** When a job finishes the app shall refresh accounts, connections, net-worth, transactions and categorization counts.
- **ACC-052** A sync shall update the balance, insert only new bank movements, apply rules, run the automatic categorization pass for the rest, and report inserted/categorized/uncategorized counts.
- **ACC-053** A bank authorization failure during sync shall mark the connection expired so the user is asked to renew.

#### Consent lifecycle
- **ACC-054** A consent shall be valid 90 days from the moment the user grants it.
- **ACC-055** The server shall email once when a consent is 7 days from expiry and once when expired (within 30 days), linking to the renewal flow.

## Mobile adaptation notes
- **Proposal — needs product sign-off:** Bank consent opens in an in-app secure browser (ASWebAuthenticationSession on iOS, Custom Tabs on Android). The connection's GoCardless `redirect` must return to the app via a universal/app link (e.g. `https://<app-host>/conti/collega/{id}` claimed by the app) after the web callback; if the app link is not intercepted, the web page must offer "Apri nell'app". Requires backend support for a mobile redirect target (see Open questions).
- **Proposal — needs product sign-off:** On return with `bankError`, mobile shows a toast/banner: `consent_failed` → "La banca non ha confermato il consenso. Riprova."; `gocardless_unavailable` → "Banca non raggiungibile, riprova tra poco."; `missing_ref`/`not_found` → generic retry message (copy to be added to catalogs).
- **Proposal — needs product sign-off:** Account rows: tap = detail sheet; trailing list icon = movements; swipe-left reveals `Vedi movimenti`. Sparkline shown on phone too (web hides it below `sm`).
- **Proposal — needs product sign-off:** Global sync progress uses a native bottom floating "island" above the tab bar (same states as web); while the app is backgrounded polling stops and resumes on foreground with an immediate refresh.
- **Proposal — needs product sign-off:** Country selector is a native picker sheet; institutions list is a searchable full-screen list with sticky search field.
- **Proposal — needs product sign-off:** `Come funziona` opens the security page in the in-app browser; `Importa un file CSV o Excel` follows the imports feature (system document picker).
- **Proposal — needs product sign-off:** Renewal push/email deep link `/liquidita/conti?rinnova=1` is registered as an app link and opens Conti with the renewal sheet.

## Open questions
1. GoCardless redirect is fixed to `${APP_URL}/api/gocardless/callback` and then to the web page `/conti/collega/{id}`; native apps need a deep-link return path (app link on that URL, or a `platform=mobile` variant) — backend change needed.
2. `bankError` query codes are produced by the callback but nothing in the web UI displays them: user gets no feedback on failed consent. Define copy for both web and mobile.
3. Conti reads the "new account" parameter with `tr("nuovo")` → expects `?new`/`?neu` in en/de while Primi passi links `?nuovo=1`: the dialog does not auto-open for English/German users (web bug).
4. Renewal-banner sentences (`describeRenewalAlert`) and sync job texts (`describeAccountProgress`, `buildSyncSummaryMessage`, `buildSyncErrorMessage` with `it-IT` time format) are built without translation; verify en/de behaviour.
5. Manual account copy says `Da qui in poi lo aggiornano i movimenti che registri.` but adding a manual movement does not change the stored balance (balance series for manual accounts is flat). Product decision: auto-adjust balance or change copy?
6. `renewableInstitutionIds` from capacity is not used by the UI; renewal relies on the user re-picking the same bank and on `Ricollega a` in Conti trovati. Should mobile pre-select the bank?
7. Deleting an account also deletes all its movements, but the manual confirmation only mentions "insieme al suo saldo registrato" and the linked one doesn't mention movements; consider clearer copy.
8. Session: all endpoints rely on better-auth cookies; also the consent return requires an authenticated session in the browser that handles the callback (in-app browser cookie jar may differ from the app's session).
9. `POST /api/gocardless/connections` passes `language` from the profile (IT/EN/DE) to the bank consent page; DE users with language `de` are fine, but FR/ES/GB banks will get IT/EN/DE only.
10. Sync budget/rate-limit sandbox behaviour (silent skip when GoCardless limit reached) means a manual sync can end as `limited`; confirm acceptable UX on mobile.
