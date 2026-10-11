# Limite dei collegamenti bancari GoCardless (2026-10-11)

Il piano gratuito di GoCardless Bank Account Data dà 50 collegamenti. Da oggi: **una banca per persona**, **al massimo 40 banche nuove** in tutta l'app, **3 consensi per persona in 31 giorni** (nuovi, rinnovi e tentativi non conclusi); i rinnovi di una banca già collegata usano la riserva fino a 50. Tutto configurabile (`GOCARDLESS_MAX_CONNECTIONS_PER_USER`, `GOCARDLESS_MAX_ATTEMPTS_PER_USER`, `GOCARDLESS_MAX_CONNECTIONS`, `GOCARDLESS_PROVIDER_LIMIT`).

- **Cosa conta**: la documentazione GoCardless non dice se eliminare una requisition libera il posto nel mese (l'errore è `CompanyRequisitionLimitReached`, 402; segnalazioni di utenti dicono di no). Quindi i posti usati sono il **maggiore** tra requisition vive e consensi avviati negli ultimi 31 giorni, contati dalla nuova tabella `bank_connection_attempts` (migration 0032), che non si svuota quando una connessione viene eliminata.
- **Niente superamento per richieste simultanee**: conteggio e creazione della connessione stanno in una transazione con `pg_advisory_xact_lock` (test con 10 richieste in parallelo).
- **Scollegare libera subito**: eliminando l'ultimo conto di una banca, o rinnovando su una nuova connessione, la requisition viene eliminata su GoCardless e la riga cancellata (se GoCardless non risponde, resta alla pulizia giornaliera).
- **Chi ha già più banche** le tiene e può rinnovarle; non ne aggiunge altre.
- Interfaccia: nel dialog «Nuovo conto» la scelta «Collega la tua banca» diventa non disponibile con «In arrivo» (posti finiti) o «Una per persona», e indica conto manuale e import da file.
- Rimandato: lista d'attesa con avviso quando si libera un posto, numero di posti residui visibile agli utenti.
