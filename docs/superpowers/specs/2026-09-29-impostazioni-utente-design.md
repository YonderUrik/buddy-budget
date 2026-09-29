# Impostazioni utente e gestione account — design

Data: 2026-09-29 · Stato: **implementata** (branch `claude/user-management-page-4suqzv` in entrambi i repo)

## Richiesta

L'utente vuole una pagina in cui ognuno imposta i propri parametri e può esportare i dati, resettarli, disattivare
l'account o eliminarlo in modo definitivo. Claude ha proposto anche altre funzioni, che l'utente ha accettato tutte.
Vincolo esplicito dell'utente: tutto deve funzionare davvero, compresa la scadenza delle sessioni. Niente parti "finte".

## Decisioni prese con l'utente

| Tema | Scelta |
|---|---|
| Disattivazione | **Eliminazione con 30 giorni di ripensamento** (`DEACTIVATION_GRACE_DAYS`). L'account si blocca subito: altre sessioni chiuse, sync e cron fermi. Un cron lo elimina alla scadenza. Rientrando prima si vede "Riattiva account". |
| Reset | **Tutto**: si cancella ogni dato e si riparte dall'onboarding (`onboardingCompleted = false`, valuta EUR, pagina iniziale di default, categorie di default ricreate). Restano account, nome, email, metodi di accesso e sessioni. |
| Export | **ZIP con JSON completo + CSV** (separatore `;`, decimali con la virgola, BOM: si aprono bene in Excel italiano). |
| Aggiunte | Pagina iniziale scelta dall'utente, sessioni attive con disconnessione, riepilogo dei dati, **accesso recente** per le azioni sensibili. |

## Cosa c'è nella pagina `/impostazioni`

Ci si arriva dal menu dell'avatar in sidebar.

1. **Profilo**: nome modificabile, email in sola lettura, data di iscrizione. Metodi di accesso: il magic link
   è sempre attivo; per Google c'è "Collega" se non è ancora collegato (`authClient.linkSocial`).
2. **Preferenze**:
   - **valuta** (whitelist `SUPPORTED_CURRENCIES`, con avviso che gli importi salvati non vengono convertiti);
   - **pagina iniziale** (`HOME_PAGE_OPTIONS`; `/` e il post-login rimandano lì);
   - **tema** chiaro/scuro/sistema, per dispositivo;
   - **lingua**, disabilitata con "Presto" finché non c'è l'i18n.
3. **Sessioni attive**:
   - dispositivo (dallo user agent), ultima attività, scadenza;
   - "Disconnetti" su una sessione, "Esci da tutti gli altri dispositivi";
   - le sessioni scadute non compaiono;
   - durata esplicita in `lib/auth/constants.ts`: 7 giorni senza utilizzo, rinnovo ogni giorno (`SESSION_EXPIRES_IN_DAYS`, `SESSION_UPDATE_AGE_DAYS`).
4. **I tuoi dati**: riepilogo dei conteggi e "Scarica i miei dati".
5. **Zona pericolosa**:
   - **Resetta**: si scrive `RESETTA` per confermare;
   - **Disattiva**;
   - **Elimina**: si scrive l'email dell'account (maiuscole ignorate) per confermare.

## Sicurezza

- **Accesso recente** (`RECENT_LOGIN_MAX_AGE_MINUTES = 10`).
  - Riguarda export, reset, disattivazione ed eliminazione: rispondono `403 { code: "reauth_required" }` se la sessione è più vecchia.
  - La UI lo sa già da `recentLoginUntil` e mostra al posto della conferma il pannello "conferma che sei tu": nuovo magic link o nuovo accesso Google, poi si torna in Impostazioni con una sessione nuova.
  - L'export è incluso anche se non è distruttivo, perché contiene tutti i dati finanziari in un file.
- **Account disattivato**: il proxy manda ogni pagina su `/account-disattivato` e risponde 403 a tutte le API tranne `/api/user/reactivate` (`/api/auth` resta pubblica per uscire).
- **Campi utente non modificabili da better-auth**: tutti gli `additionalFields` hanno `input: false`. Prima `/api/auth/update-user` permetteva di impostare `currency` (senza whitelist) e `onboardingCompleted` a piacere.
- **Sessioni**: l'elenco non espone mai token né IP. La disconnessione controlla che la sessione sia dell'utente (IDOR testato).
- **CSV**: i valori che iniziano con `= + - @` vengono neutralizzati (formula injection da descrizioni bancarie). I numeri negativi restano numeri.
- **Log**: solo eventi `account.*` con `user` hashato, niente email.

## Cosa si cancella (reset ed eliminazione)

Nell'ordine delle FK, in una transazione:
- PAC e operazioni di investimento, portafogli e prezzi manuali;
- **strumenti manuali creati dall'utente** e non usati da altri;
- storico del patrimonio, transazioni, budget, regole;
- connessioni bancarie (i link vanno via in cascata), conti, categorie.

Prima della transazione si **revocano i consensi GoCardless** (`DELETE /requisitions/{id}/`, best effort: un errore non blocca, il consenso scade comunque entro 90 giorni). Dopo si puliscono le chiavi Redis dell'utente (job di sync, impronta dello storico). Reset ed eliminazione rispondono 409 se c'è un sync bancario in corso.

**Bug evitato scrivendo il lifecycle**: gli strumenti manuali sono privati (`createdByUserId`), ma la FK è `on delete set null`. Eliminando l'utente sarebbero diventati visibili a **tutti** gli utenti (`visibleTo` = comuni o propri).

## Cron `account-deletion`

- `GET /api/cron/account-deletion` (CRON_SECRET), ogni giorno alle 03:30 (CronJob nel repo infra).
- Elimina gli utenti con `deletion_scheduled_at <= now`. Se anche un solo utente fallisce, il cron risponde 500 e registra `error`, così l'alert `bb-cron-non-eseguito` (già `by (cron)`) lo segnala.
- I cron `gocardless-sync` e `net-worth-snapshot` saltano gli utenti disattivati.

## Email

Via Resend, best effort:
- alla disattivazione, con la data e come riattivare;
- dopo l'eliminazione.

## Deroghe allo standard "Operazioni lunghe"

Export, reset ed eliminazione sono sincroni: sole letture/scritture DB di un utente, pochi secondi. Stessa motivazione di `categorize-apply` e dell'import CSV investimenti. Da rivedere se un utente arriva a centinaia di migliaia di righe.

## Schema

Migration `0002_impostazioni_utente`: `auth_user.home_page` (text, default `/panoramica`) e `auth_user.deletion_scheduled_at` (timestamptz, nullable). In produzione la applica il Job `PreSync` di ArgoCD.

## Rimandato consapevolmente

- **Cambio email**: con magic link e Google serve un flusso di verifica dedicato.
- **Scollegare Google**: oggi si può solo collegare.
- **Notifiche email** (riepilogo mensile, consenso bancario in scadenza).
- **Import dell'export JSON**: il formato è versionato (`EXPORT_FORMAT_VERSION`) proprio per poterlo fare.
- **Lingua**: arriva con l'i18n.
