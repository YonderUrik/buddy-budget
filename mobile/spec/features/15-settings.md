# Settings
Status: draft · Source: app/(app)/impostazioni/page.tsx, components/domain/settings/*, components/domain/notifications/*, components/privacy-provider.tsx, lib/queries/user-settings.ts, lib/queries/notifications.ts, lib/account/*, lib/notifications/{constants,emails,run,store}.ts, lib/sidebar/modules.ts, lib/hooks/{use-sidebar-preferences,use-analytics-opt-out}.ts, lib/legal/*, lib/validation/{user-settings,notifications}.ts, app/api/user/*

## Purpose
One place for the user's profile, display preferences, optional emails, AI categorisation consent, privacy/legal information and data rights (export), and the destructive account actions (reset, deactivate with 30-day grace, immediate delete). All sensitive actions require a **recent login** (session created ≤ 10 minutes ago) plus an explicit confirmation.

## Entry points & navigation
- Route `/impostazioni`; reachable from the app navigation (sidebar / mobile «Altro»). The selected group is in `?sezione=<id>` with ids `account`, `aspetto`, `notifiche`, `privacy`, `pericolo`; unknown values are ignored.
- Legacy anchors still resolve to groups (used by emails already sent): `#impostazioni-notifiche`/`#impostazioni-assistente-categorie` → notifiche; `#impostazioni-privacy`/`#impostazioni-dati` → privacy; `#impostazioni-barra-laterale`/`#impostazioni-preferenze` → aspetto; `#impostazioni-profilo`/`#impostazioni-sessioni` → account; `#impostazioni-zona-pericolosa` → pericolo.
- Notification emails link to `/impostazioni?sezione=notifiche#impostazioni-notifiche`.
- Re-authentication (magic link / Google) returns to `/impostazioni`.

## Screens

> **Phone layout (Phase 4R, web 0.81.0).** The hub lists the five groups as condensed display titles (30, `Zona pericolosa`
> in `--neg`) with the summary under each and a chevron — no icons, no rules. Inside a group, sections stand on a
> `font-heading text-lg semibold` title with no icon tile.

### Settings hub
- Page title `Impostazioni`, subtitle `Il tuo profilo, le preferenze e il controllo sui tuoi dati.` (hidden on phone while inside a group).
- Groups (order, label, summary):
  1. `Account` — `Il tuo profilo e i dispositivi collegati` (Profilo, Sessioni attive)
  2. `Aspetto e uso` — `Valuta, tema, pagina iniziale e barra laterale` (Preferenze, Barra laterale)
  3. `Notifiche e AI` — `Email di riepilogo e avvisi, assistente per le categorie e dove l'app usa l'AI` (Notifiche, Assistente per le categorie; renamed by web #394)
  4. `Privacy e dati` — `Statistiche anonime, esportazione e informative` (Privacy, I tuoi dati)
  5. `Zona pericolosa` — `Azzera i dati, disattiva o elimina l'account` (danger colour)
- Phone: list of groups (icon, name, summary, chevron); tapping opens the group with BackLink `‹ Impostazioni` (back returns to the list, using history back when opened from the list). Desktop: fixed index on the left, first group shown by default.
- Loading: 5 skeleton rows. Error: `Impossibile caricare le impostazioni.` with retry. _API: `GET /api/user/settings`_
- `GET /api/user/settings` returns `name, email, image, productCountry, language, currency, homePage, hideAmounts, legalAcceptedAt, legalAcceptedVersion, createdAt, googleLinked, recentLoginUntil`.
- Some sections show a decorative «Anteprima» illustration with a caption (sidebar layout, sample email, category proposal card).

### Account › Profilo
- `Nome` (hint `Come ti chiamiamo nell'app.`): text field (placeholder `Il tuo nome`, max 80) + `Salva` (enabled only when trimmed value is non-empty and differs). Success `Nome salvato`; error message from server. Server: trimmed, 1–80 chars (`Il nome non può essere vuoto`, `Massimo 80 caratteri`). _API: `PATCH /api/user/settings {name}`_
- `Email` (read-only), hint `Con BuddyBudget dal {long date}.` Email cannot be changed in-app (see Privacy › `Correggere un dato`).
- `Metodi di accesso` (hint `Puoi entrare con uno qualsiasi di questi.`): `Link via email` · `attivo`; `Google` · `collegato` or button `Collega` (links Google via OAuth, returns to `/impostazioni`; error `Collegamento non riuscito. Riprova.`). Unlinking is not available.

### Account › Sessioni attive
- Description `I dispositivi da cui hai fatto l'accesso. Una sessione scade dopo 7 giorni senza utilizzo.`
- One row per non-expired session: device icon (phone/computer), `{browser} su {os}`, badge `questo dispositivo` for the current one, `Ultima attività {relative time} · scade il {long date}`. Other sessions have `Disconnetti`. No IP or token is shown.
- `Esci da tutti gli altri dispositivi` shown when at least one other session exists.
- The current session cannot be revoked here (server 400 `Per chiudere questa sessione usa Esci.`); unknown id → 404 `Sessione non trovata`.
- Loading skeleton; error `Impossibile caricare le sessioni.` with retry. _API: `GET /api/user/sessions`, `DELETE /api/user/sessions/{id}`, `DELETE /api/user/sessions`_

### Aspetto e uso › Preferenze
- `Valuta` (hint `Cambia solo come vengono mostrati gli importi: quelli già salvati non vengono convertiti.`): select `Euro (€)`, `Dollaro USA ($)`, `Sterlina britannica (£)`, `Franco svizzero (CHF)`. Saves on change; all cached data is refreshed.
- `Pagina iniziale` (hint `Dove atterri dopo l'accesso.`): `Panoramica` (default), `Liquidità`, `Conti`, `Analisi dei movimenti`, `Investimenti`. Legacy stored values `/conti`, `/movimenti`, `/movimenti/analisi` map to `/liquidita/conti`, `/liquidita`, `/liquidita/analisi`; invalid → `/panoramica`.
- `Tema` (hint `Vale per questo dispositivo.`): segmented `Chiaro` | `Scuro` | `Sistema` (default Sistema); stored on device only.
- Locale fields (web #397): two rows, `Paese` (hint `Decide tasse e funzioni disponibili.`; `Italia`, `Germania`, `Altro paese` with their flags — a globe for Altro paese, web #465) and `Lingua` (hint `Cambia solo testi, date e numeri.`), the language opening the list of every language with a preview of today's date and `1.234,56` in the user's currency as that language writes them, the ones not offered for the country greyed with `Disponibile col paese {0}` (IT: Italiano, English; DE: English, Deutsch); switching country to one not supporting the current language sets English. (Flags are visual, Phase 4R.) when DE: `Per la Germania, tasse, pensione, previsioni dei dividendi e pianificazione del pensionamento non sono ancora disponibili. I dati esistenti vengono conservati.` Saving country or language reloads the whole app (all country-dependent caches reset). Server 400 `unsupported_locale` for invalid combinations.
- Controls are disabled while a save is in flight; errors shown below the section.
- **Hide amounts default:** there is no row in Settings. `hideAmounts` is a per-account flag toggled by the global «nascondi importi» (eye) control in the sidebar / mobile menu; it is persisted with `PATCH /api/user/settings {hideAmounts}` (optimistic, reverted on failure), restored at next sign-in on every device, and also masks amounts (`••••`) in notification emails.
- Server validation for `PATCH /api/user/settings` (strict, at least one field): `name`, `productCountry ∈ {IT,DE}`, `language ∈ {it,en,de}`, `currency ∈ {EUR,USD,GBP,CHF}` (`Valuta non supportata`), `hideAmounts: boolean`, `homePage ∈ options` (`Pagina non valida`); empty body → `Nessuna modifica`. Success 204.

### Aspetto e uso › Barra laterale
- Description `Scegli cosa vedere sotto il menu. Vale per questo dispositivo.`; preview caption `A sinistra la barra su computer, a destra il telefono. I blocchi spenti si attenuano; la barra in basso sostituisce il menu a scomparsa.`
- One switch per module (all on by default, stored per device in localStorage `bb:sidebar:module:<id>`; a disabled module does not load its data):
  - `Patrimonio netto` — `Il totale di oggi e la variazione dell'ultimo mese.`
  - `Portafoglio` — `Valore degli investimenti e posizioni principali.`
  - `Watchlist` — `I titoli che segui, con gli avvisi di prezzo scattati.`
  - `Prossime scadenze` — `Rate dei finanziamenti e collegamenti bancari da rinnovare.`
  - `Obiettivo FIRE` — `Quanto manca al numero FIRE, con le ipotesi di Analitiche.` — **hidden when the country's `retirement` feature is off** (since web #465 `retirement` is on in every country, so it shows for IT, DE and OTHER).
- `Barra in basso su mobile` (default on, key `bb:mobile:bottom-nav`) — `Le sezioni principali in basso, con «Altro» per il resto. Spenta, torna il menu a scomparsa.`

### Notifiche e assistente › Notifiche
- Description `Email di riepilogo e di avviso a {email}. Sono facoltative e partono spente; ognuna ha il link per disattivarla. Le email di servizio (link di accesso, sicurezza, account) non si possono disattivare.`; preview caption about the sample email.
- Switch rows (default all off), each saved immediately:
  - `Riepilogo periodico` — `Entrate, uscite e investimenti del periodo appena concluso, in poche righe.`
  - `Avvisi sul budget` — `Una email quando una categoria arriva all'80% del budget mensile e quando lo supera.`
  - `Avvisi sulle scadenze` — `Una email quando manca poco alla rata di un finanziamento, o quando è scaduta.`
  - `Promemoria sugli obiettivi` — `A inizio mese a che punto sono i tuoi obiettivi, e una email quando ne raggiungi uno o quando la data si avvicina.` — **hidden for DE** (goals live under `/analitiche/obiettivi`, unavailable in DE); the server also never sends goal emails to DE users.
- `Frequenza del riepilogo` (only when digest on; hint `Il riepilogo parla dell'ultimo periodo concluso.`): `Ogni settimana (lunedì)` | `Ogni mese (primi giorni)` (default monthly).
- `Vedi un esempio` (hint `Ti mandiamo il riepilogo dell'ultimo mese con i tuoi dati. Non attiva nulla.`): button `Mandami un esempio` (pending `Invio…`); success `Inviato: controlla la posta.`; errors: 429 `Hai già chiesto alcuni esempi: riprova tra un po'.` (max 3/hour), 409 `Nel mese scorso non hai movimenti né investimenti: l'esempio sarebbe vuoto.`, 502 `Non siamo riusciti a inviare l'email. Riprova tra poco.` The example is always the monthly digest, subject prefixed `Esempio · `.
- Loading skeleton; error `Impossibile caricare le preferenze sulle notifiche.`
- Delivery rules (user-visible): monthly digest in days 1–3 of the month, weekly on Monday (retry Tuesday), about the last completed period; budget alerts at 80% and 100% of a monthly category budget; deadline alerts 3 days before an installment or when overdue; at most one alert email per 24 h and 3 per rolling week (budget + deadlines combined); goal reminder in days 1–3 of the month, plus emails when a goal is reached or its date is within 30 days and not on track. Deactivated accounts receive none. Each email carries a one-click unsubscribe link (see 01-auth-onboarding).
- Server: `PATCH /api/user/notifications` strict partial of `{digestEnabled, digestFrequency ∈ {settimanale, mensile}, budgetAlertsEnabled, deadlineAlertsEnabled, goalAlertsEnabled}`, at least one field (`Nessuna preferenza da aggiornare`); returns the full preferences. _API: `GET/PATCH /api/user/notifications`, `POST /api/user/notifications/test`_

### Notifiche e AI › Assistente per le categorie
- Description `Propone una categoria per i movimenti nuovi di sincronizzazioni e importazioni. Quelle in dubbio le scegli tu; se vuoi, quando è abbastanza sicura l'app la mette da sola e la ritrovi in Categorizza.`
- **«Dove l'app usa l'AI»** (web #394, #460), a filled block at the top of the section with the `Usa l'AI` tag (sparkles icon, small pill) next to its title, listing the three places where data can reach an AI model, each with what is sent and where it is allowed:
  - `Proposte di categoria`; `Invia il nome pulito dell'esercente, se è un'entrata o un'uscita, le tue categorie e le tue istruzioni: mai importi, date, IBAN, note o nomi di persone.` `Lo attivi qui sotto, con «Proponi le categorie con l'AI»; vale anche per «Chiedi all'AI» nel dettaglio di un movimento.`
  - `Importazione di un estratto conto in un formato nuovo`; `Invia il file intero, per capire come sono fatte le colonne. Con un formato già salvato lo invia solo se la lettura non riesce.` `Te lo chiede a ogni file, nell'ultimo passo dell'importazione in Liquidità.`
  - `Importazione degli investimenti, se la lettura non riesce`; `Invia il file intero, solo per quell'importazione.` `Solo se spunti la casella nell'importazione in Investimenti.`
  - then `Senza il tuo sì non parte niente. Tutto il resto dell'app (calcoli, regole, sincronizzazione con la banca, avvisi) non usa l'AI.` and `Zero data retention: i dati passano da OpenRouter solo verso fornitori che non li conservano dopo la risposta e non li usano per l'addestramento. Se nessuno è disponibile, la richiesta non parte.` + link `Come funziona` (landing privacy `#zero-data-retention`, hosted only).
- `Proponi le categorie con l'AI` switch (with the `Usa l'AI` tag; label changed by web #394) = AI consent (off unless the user turned it on). Hint when available: `Se attivo, il nome pulito dell'esercente (mai importi, date, IBAN, note o nomi di persone) viene inviato a OpenRouter insieme alle categorie e alle tue eventuali istruzioni, solo verso fornitori che non conservano i dati (zero data retention). Puoi revocare in ogni momento.` (web #460); when the server has no AI service: `Il servizio non è configurato su questo server.` and the switch is disabled. Revoking stops new requests immediately; pending AI proposals stop auto-applying.
- `Lascia che l'app scelga quando è abbastanza sicura` switch (`autoApply`, default off; works also without AI, from past choices) — hint `Non usa l'AI da sola. Le tue regole valgono sempre. Se attivo, l'app mette da sola anche le categorie di cui è abbastanza sicura (almeno al 70%, dalle tue scelte passate o, se lo hai attivato, dall'assistente). Le ritrovi in Categorizza → «Messe dall'app», dove puoi cambiarle.` (web #394, #456) Turning it on immediately applies to pending movements.
- Personal instructions: label `Le tue istruzioni per l’AI` (with the `Usa l'AI` tag, web #394), hint `Spiega come preferisci dividere le spese. Questo testo viene inviato all’assistente quando è attivo: non inserire dati personali o bancari.`, multiline field max 2000 chars with counter `N/2000 · Le modifiche valgono per le nuove proposte. Dopo il salvataggio, premi «Categorizza con l’AI» per rigenerare quelle in attesa.`, placeholder `Per esempio: metti le consegne di pasti in Ristoranti & Bar e gli acquisti di libri in Svago.` Button `Salva istruzioni` (enabled when changed; pending `Salvataggio…`); success `Istruzioni salvate. Le categorie già assegnate restano invariate.` Saving changed instructions deletes pending («in_attesa») suggestions server-side.
- Loading skeleton; error `Impossibile caricare l'impostazione.` _API: `GET/PATCH /api/user/ai-categorization {enabled?, instructions? (trimmed ≤ 2000), autoApply?}`_

### Privacy e dati › Privacy
- Description `Come trattiamo i tuoi dati e come esercitare i tuoi diritti. Scarica e cancella i dati dalle sezioni qui sotto.`
- `Statistiche d'uso anonime` switch (on = measured; default on; per device) — `Contano le pagine viste e le azioni (mai importi o testi tuoi), senza cookie. Spegnile e non ti misuriamo più su questo dispositivo.`
- `Documenti`: hint `Hai accettato la versione del {version} il {long date}.` or `Non risulta un'accettazione registrata.`; links `Privacy`, `Termini`, `Cookie` (landing, new tab).
- `Per le altre richieste scrivi a privacy@buddybudget.io: rispondiamo entro un mese. Questi link aprono una email già compilata.` Four pre-filled email requests (subject `Richiesta privacy: <label>`, body citing the GDPR article and the account email): `Correggere un dato` (art. 16), `Limitare il trattamento` (art. 18), `Oppormi al trattamento` (art. 21), `Altre informazioni sui miei dati` (art. 15), each with its one-line description.

### Privacy e dati › I tuoi dati
- Description `Puoi scaricare in qualsiasi momento tutto quello che hai inserito o importato.`
- Counts list (zeros shown, singular/plural): conti, banche collegate, transazioni, categorie, regole di categorizzazione, budget, operazioni di investimento, debiti, fondi pensione, giorni di storico del patrimonio. Error `Impossibile caricare il riepilogo dei dati.` with retry. _API: `GET /api/user/data-summary`_
- Text `L'archivio ZIP contiene un file JSON con tutti i dati e una tabella CSV per transazioni, conti, categorie, budget, regole, investimenti e storico del patrimonio, da aprire con Excel.`
- `Scarica i miei dati` (pending `Preparazione in corso…`) downloads `buddybudget-export-YYYY-MM-DD.zip` (README, `dati-completi.json`, CSVs: transazioni, conti, categorie, budget, abbonamenti, obiettivi, regole-categorizzazione, investimenti-operazioni, investimenti-titoli-seguiti, investimenti-avvisi-prezzo, debiti, debiti-eventi, previdenza-fondi, previdenza-fotografie, patrimonio-netto). Requires recent login; otherwise the Reauth panel replaces the button. _API: `GET /api/user/export`_

### Reauth panel (shared by export and the danger zone)
- Shown when `recentLoginUntil` has passed (re-checked every 15 s while the page is open) or the server answers 403 `reauth_required`.
- `Per sicurezza, conferma che sei tu` / `Questa azione richiede un accesso fatto negli ultimi 10 minuti. Accedi di nuovo e torni qui.`
- `Inviami un link di accesso` → magic link to the account email (callback `/impostazioni`), then `Ti abbiamo inviato un link a <email>. Aprilo per continuare.`; error `Non siamo riusciti a inviare il link. Riprova tra poco.`
- `Accedi con Google` (only if Google linked); error `Accesso con Google non riuscito. Riprova.`

### Zona pericolosa
- Description `Azioni che cancellano i tuoi dati. Per sicurezza ti chiediamo di confermare la tua identità.` Each row: title, summary, red button opening a confirmation dialog (bottom sheet on phone). If login not recent, the dialog body is the Reauth panel and the confirm button is hidden. Dialog can't be dismissed while pending. Common actions: `Annulla`.
- **Resetta tutti i dati** — summary `Cancella conti, transazioni, investimenti, categorie, regole, budget e storico. Riparti dall'inizio.`; button `Resetta`; dialog `Resettare tutti i dati?` — `Vengono cancellati per sempre conti, transazioni, investimenti, categorie, regole, budget e storico del patrimonio. I collegamenti con le banche vengono revocati.` / `Restano il tuo account e i metodi di accesso. Ripartirai dalla scelta della valuta.`; typed confirmation `Scrivi RESETTA per confermare` (exact, case-sensitive); confirm `Resetta tutto`. Result: bank consents revoked, all financial data deleted, default categories re-seeded, currency EUR, home page Panoramica, onboarding restarts → app reloads at `/onboarding`. Server errors: 400 `Scrivi RESETTA per confermare.`, 409 `C'è una sincronizzazione bancaria in corso: riprova quando è finita.` _API: `POST /api/user/reset {confirmation:"RESETTA"}`_
- **Disattiva l'account** — summary `L'account si blocca subito e viene eliminato dopo 30 giorni. Rientrando prima puoi riattivarlo.`; button `Disattiva`; dialog `Disattivare l'account?` — `Verrai disconnesso da tutti gli altri dispositivi e le sincronizzazioni con le banche si fermano. Tra 30 giorni l'account e tutti i dati verranno eliminati definitivamente.` / `Se cambi idea, accedi prima di quella data e scegli "Riattiva account". Ti mandiamo un'email con la data.`; no typed confirmation; confirm `Disattiva account`. Result: deletion date = now + 30 days, other sessions closed, email `Il tuo account BuddyBudget è stato disattivato`, app reloads at `/account-disattivato`. 409 `L'account è già disattivato.` _API: `POST /api/user/deactivate` → `{deletionScheduledAt}`_
- **Elimina l'account** — summary `Cancella subito e per sempre l'account e tutti i dati. Non si può annullare.`; button `Elimina`; dialog `Eliminare l'account per sempre?` — `L'account e tutti i dati vengono cancellati subito, senza possibilità di recupero. I collegamenti con le banche vengono revocati.` / `Se vuoi tenere una copia, scarica prima i tuoi dati dalla sezione "I tuoi dati".`; typed confirmation `Scrivi la tua email per confermare` (account email displayed below; match trimmed, case-insensitive); confirm `Elimina per sempre`. Result: data and user deleted, email `Il tuo account BuddyBudget è stato eliminato`, app goes to `/login?account=eliminato`. Errors 400 `L'email scritta non corrisponde a quella dell'account.`, 409 sync in progress. _API: `DELETE /api/user/account {email}`_
- All four sensitive endpoints (export, reset, deactivate, delete) return 403 `{code:"reauth_required", error:"Per sicurezza accedi di nuovo prima di continuare."}` when the session is older than 10 minutes.

### Not in Settings
- Demo/sample data is not managed here (it lives in the Start area, `/api/start/demo`, see that feature). There is no in-app password, email change, Google unlink, or 2FA.

## Requirements

#### Hub
- **SET-001** (changed by web #394) Settings shall group sections into `Account`, `Aspetto e uso`, `Notifiche e AI`, `Privacy e dati`, `Zona pericolosa`, in this order, with their summaries. _API: `GET /api/user/settings`_
- **SET-002** On phone, Settings shall first show the group list; opening a group shall show `‹ Impostazioni` to return to the list.
- **SET-003** The selected group shall be addressable by deep link `/impostazioni?sezione=<id>`, and legacy `#impostazioni-*` anchors shall open the corresponding group.
- **SET-004** While settings load the app shall show placeholders; on failure `Impossibile caricare le impostazioni.` with a retry action.

#### Profile
- **SET-005** The user shall be able to edit the display name (trimmed, 1–80 characters); `Salva` shall be enabled only when the value is valid and changed, and success shall show `Nome salvato`. _API: `PATCH /api/user/settings`_
- **SET-006** The profile shall show the account email read-only and the registration date (`Con BuddyBudget dal {date}.`).
- **SET-007** The profile shall list sign-in methods: email link always `attivo`; Google `collegato` or a `Collega` action that links Google to the account.
- **SET-008** A failed Google link shall show `Collegamento non riuscito. Riprova.`

#### Sessions
- **SET-009** The app shall list all non-expired sessions with browser, OS, device type, last activity (relative) and expiry date, marking the current one `questo dispositivo`. _API: `GET /api/user/sessions`_
- **SET-010** The user shall be able to disconnect any other single session with `Disconnetti`. _API: `DELETE /api/user/sessions/{id}`_
- **SET-011** When other sessions exist, `Esci da tutti gli altri dispositivi` shall close all sessions except the current one. _API: `DELETE /api/user/sessions`_
- **SET-012** The current session shall not offer `Disconnetti`.

#### Preferences
- **SET-013** Changing `Valuta` (EUR, USD, GBP, CHF) shall save immediately and re-format all amounts without converting stored values. _API: `PATCH /api/user/settings {currency}`_
- **SET-014** Changing `Pagina iniziale` shall save immediately and determine where `/` lands after sign-in; options are Panoramica (default), Liquidità, Conti, Analisi dei movimenti, Investimenti. _API: `PATCH /api/user/settings {homePage}`_
- **SET-015** `Tema` (Chiaro, Scuro, Sistema; default Sistema) shall apply immediately and be stored only on the device.
- **SET-016** Changing product country or language shall save and reload the app so all country-dependent data and navigation reflect the new profile. _API: `PATCH /api/user/settings {productCountry, language}`_
- **SET-017** (changed by web #397) Country and language shall be two rows; the language list shall show every language with a date and amount preview, offering only those of the country (IT: it, en; DE: en, de; OTHER: en, it, de) and greying the others with `Disponibile col paese {0}`; switching to an incompatible country shall select English.
- **SET-018** (changed by web #465) Under the locale rows Preferences shall show the chosen country's note (`COUNTRY_UNAVAILABLE_NOTES`, see AUTH-028): DE pension note, OTHER taxes-and-pension note, nothing for IT. The country is never changed automatically.
- **SET-019** The «hide amounts» state shall be stored on the account, restored on every device at sign-in, and toggled from the global privacy control (not from Settings). _API: `PATCH /api/user/settings {hideAmounts}`_

#### Sidebar / navigation
- **SET-020** The user shall be able to show/hide each sidebar module (Patrimonio netto, Portafoglio, Watchlist, Prossime scadenze, Obiettivo FIRE), all shown by default, stored per device.
- **SET-021** The `Obiettivo FIRE` module option shall not be shown when the retirement feature is unavailable for the product country (since web #465 it is available in IT, DE and OTHER).
- **SET-022** The user shall be able to toggle `Barra in basso su mobile` (default on), stored per device.

#### Notifications
- **SET-023** The app shall show switches for `Riepilogo periodico`, `Avvisi sul budget`, `Avvisi sulle scadenze`, `Promemoria sugli obiettivi`, all off by default, each saved on toggle. _API: `GET/PATCH /api/user/notifications`_
- **SET-024** `Promemoria sugli obiettivi` shall be hidden when `/analitiche/obiettivi` is unavailable for the product country (`capabilities.sections.goals`; open in every country since web #465).
- **SET-025** `Frequenza del riepilogo` (`Ogni settimana (lunedì)` / `Ogni mese (primi giorni)`, default monthly) shall be shown only while the digest is on.
- **SET-026** The section description shall include the account email and state that service emails cannot be disabled.
- **SET-027** `Mandami un esempio` shall send the last-month digest with the user's data to the account email, without changing preferences, and show `Inviato: controlla la posta.` _API: `POST /api/user/notifications/test`_
- **SET-028** The example shall be limited to 3 per hour (`Hai già chiesto alcuni esempi: riprova tra un po'.`) and refused when last month is empty (`Nel mese scorso non hai movimenti né investimenti: l'esempio sarebbe vuoto.`).
- **SET-029** Notification emails shall mask amounts as `••••` when the account has amounts hidden.

#### AI assistant
- **SET-030** (changed by web #394/#460) `Proponi le categorie con l'AI` (tagged `Usa l'AI`) shall reflect and toggle the AI consent, with the OpenRouter / zero-data-retention hint; it shall be disabled with `Il servizio non è configurato su questo server.` when the service is unavailable. _API: `GET/PATCH /api/user/ai-categorization {enabled}`_
- **SET-031** (changed by web #456) `Lascia che l'app scelga quando è abbastanza sicura` shall toggle auto-apply (≥ 70% confidence) independently of AI consent. _API: `PATCH /api/user/ai-categorization {autoApply}`_
- **SET-050** (web #394/#460) The assistant section shall open with «Dove l'app usa l'AI»: the three uses with what is sent and where they are allowed, the no-AI-without-consent line and the zero-data-retention line (with `Come funziona` on the hosted service); settings that send data to AI (`Proponi le categorie con l'AI`, personal instructions) carry the `Usa l'AI` tag.
- **SET-032** The user shall be able to edit and save personal AI instructions up to 2000 characters with a live counter; `Salva istruzioni` enabled only when changed; success `Istruzioni salvate. Le categorie già assegnate restano invariate.` _API: `PATCH /api/user/ai-categorization {instructions}`_
- **SET-033** Saving changed instructions shall discard pending (unconfirmed) suggestions so they can be regenerated.

#### Privacy
- **SET-034** `Statistiche d'uso anonime` shall be on by default and, when turned off, stop usage analytics on this device only.
- **SET-035** The Privacy section shall show the accepted legal version and acceptance date (or `Non risulta un'accettazione registrata.`) and links to Privacy, Termini, Cookie.
- **SET-036** The Privacy section shall offer the four pre-filled GDPR request emails to `privacy@buddybudget.io` (Correggere un dato, Limitare il trattamento, Oppormi al trattamento, Altre informazioni sui miei dati) including the account email in the body.

#### Data & export
- **SET-037** The data section shall show counts of the user's data for the ten listed kinds, including zeros. _API: `GET /api/user/data-summary`_
- **SET-038** `Scarica i miei dati` shall produce the ZIP `buddybudget-export-YYYY-MM-DD.zip` containing the full JSON and the CSV tables. _API: `GET /api/user/export`_

#### Recent login
- **SET-039** Export, reset, deactivate and delete shall require a session created within the last 10 minutes; otherwise the app shall show the Reauth panel instead of the action.
- **SET-040** The app shall switch to the Reauth panel when the recent-login window expires while the screen is open, and also when the server answers `reauth_required`.
- **SET-041** The Reauth panel shall offer `Inviami un link di accesso` to the account email and, if Google is linked, `Accedi con Google`, returning to Settings after sign-in.

#### Danger zone
- **SET-042** Each destructive action shall require a confirmation dialog with `Annulla`; the dialog shall not close while the action is pending.
- **SET-043** Reset shall be confirmable only after typing exactly `RESETTA`. _API: `POST /api/user/reset`_
- **SET-044** A successful reset shall delete all financial data, revoke bank consents, restore default categories, set currency EUR and home Panoramica, keep account/sign-in methods/sessions, and restart onboarding.
- **SET-045** Deactivation shall be confirmable without typing, schedule deletion 30 days later, sign out all other devices, send the deactivation email and show the deactivated-account screen. _API: `POST /api/user/deactivate`_
- **SET-046** Deletion shall be confirmable only after typing the account email (trimmed, case-insensitive). _API: `DELETE /api/user/account`_
- **SET-047** A successful deletion shall permanently remove the account and data, revoke bank consents, send the deletion email and show the login screen with the «account eliminato» notice.
- **SET-048** Reset and deletion shall be refused while a bank sync is running with `C'è una sincronizzazione bancaria in corso: riprova quando è finita.`
- **SET-049** Server error messages for destructive actions shall be shown inside the dialog.

## Mobile adaptation notes
- **Proposal — needs product sign-off:** Settings on both platforms uses the phone pattern only: a list of the five groups, each pushing a detail screen with a back button `‹ Impostazioni`; deep link `/impostazioni?sezione=<id>` opens the group directly.
- **Proposal — needs product sign-off:** «Barra laterale» does not apply to native phone navigation. Replace the section with a single per-device choice equivalent to `Barra in basso su mobile` only if the native app supports both nav styles; otherwise omit the section entirely and keep sidebar modules a web-only preference (not synced).
- **Proposal — needs product sign-off:** Theme and analytics opt-out stay per device (stored in app preferences), matching web semantics.
- **Proposal — needs product sign-off:** `Scarica i miei dati` downloads the ZIP to a temporary file and opens the system share sheet (iOS) / save dialog via Storage Access Framework (Android).
- **Proposal — needs product sign-off:** GDPR request links open the system mail composer pre-filled (to, subject, body); if no mail account is configured, show the address and copy-to-clipboard action.
- **Proposal — needs product sign-off:** `Collega` (Google) and `Accedi con Google` in the Reauth panel use the native Google SDK with ID-token exchange; after re-auth the app returns to the same Settings group and the dialog the user was in.
- **Proposal — needs product sign-off:** Reauth via magic link: after tapping the email link (Universal/App Link), the app opens back on Settings › the group that triggered it, with the new session counted as recent.
- **Proposal — needs product sign-off:** Confirmation dialogs are bottom sheets; the typed-confirmation field uses no autocorrect/autocapitalisation except uppercase for `RESETTA` and email keyboard for the delete confirmation.
- **Proposal — needs product sign-off:** Decorative «Anteprima» illustrations are omitted on native.

## Open questions
1. Recent-login uses session `createdAt`; native apps with long-lived bearer sessions will almost always need re-auth for sensitive actions — confirm acceptable UX, or provide a dedicated step-up endpoint.
2. Sidebar modules, bottom-nav, theme and analytics opt-out are localStorage-only (not on the server) — they won't sync between web and app; confirm that's intended.
3. Reset does not reset notification preferences, AI consent/instructions, auto-apply, country/language, hideAmounts or legal acceptance (only currency, home page, onboarding flag), although the code comment says "tutte le preferenze tornano ai default". Which is correct?
4. All account/notification emails are Italian-only (hard-coded strings, `it-IT` dates) regardless of the user's language; mobile users choosing en/de will still get Italian emails.
5. `FREQUENCY_LABEL` options (`Ogni settimana (lunedì)`, `Ogni mese (primi giorni)`) are rendered without `t()` — likely untranslated in en/de.
6. The export endpoint streams a ZIP synchronously (up to 60 s); large exports over mobile networks may time out — consider an async job.
7. `GET /api/user/settings` does not return notification or AI settings; mobile needs 3 calls to build the Notifiche group.
8. Account deletion succeeds even if the confirmation email fails (best effort); mobile cannot tell the user whether the email was sent.
