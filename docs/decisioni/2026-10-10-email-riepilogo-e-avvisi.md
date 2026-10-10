# Email di riepilogo e avvisi, sempre con la disiscrizione (2026-10-10)

Decisione: tre tipi di email facoltative (riepilogo periodico, avvisi sul budget, avvisi sulle scadenze delle rate) con cron giornaliero `/api/cron/notifications`. Il contenuto usa le cifre già calcolate dall'app (`lib/calc/expenses`, `lib/debts`), mai consigli sugli investimenti.
Regola di Daniele: ogni email non di servizio ha sempre il link per disiscriversi e le preferenze; le email di servizio (accesso, account, collegamento bancario, esito import, avviso di prezzo) restano senza, e lo dichiarano nel piè di pagina (`SERVICE_FOOTER_TEXT`).
Opt-in: senza riga in `notification_preferences` tutto è spento (`NOTIFICATION_DEFAULTS`); per cambiare il default basta quella costante. Gestione in Impostazioni → Notifiche.
Disiscrizione: token firmato (HMAC da `BETTER_AUTH_SECRET`, non scade), pagina pubblica `/disiscrizione` con un clic, POST one-click `/api/email/unsubscribe` per `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058). Un GET non disiscrive mai (antivirus e anteprime).
Ritmo: riepilogo mensile (default) nei primi 3 giorni del mese o settimanale il lunedì/martedì, sul periodo concluso, solo se ci sono movimenti. Avvisi: budget all'80% e al 100% della categoria (una volta per mese e soglia), rate a 3 giorni dalla scadenza o scadute; al massimo un avviso al giorno e tre a settimana (budget e scadenze insieme), più deduplica su `notification_log` (90 giorni).
`NOTIFICATIONS_MODE` = `off` | `dry-run` (default, non invia) | `execute`. In produzione si passa a `execute` a mano nel Secret dopo qualche giorno di dry-run.
Con «nascondi importi» le cifre nell'email sono coperte; gli oggetti non contengono mai cifre né nomi.
Rimandato: avvisi sugli investimenti e sul patrimonio, orario scelto dall'utente, anteprima in app, prova su client reali (Gmail, Outlook, Apple Mail), mailto in `List-Unsubscribe`.
