# Cifratura dei campi delicati nel database (2026-10-12)

- **Decisione (Daniele)**: cifrare nel database i campi testuali più delicati senza rompere i dati esistenti. Colonne `encryptedText` (AES-256-GCM, chiave `DATA_ENCRYPTION_KEY`, valore `enc:v1:…`): descrizione, testo grezzo e nota dei movimenti, note di debiti, operazioni e minusvalenze, token GoCardless. Token Google cifrati da better-auth (`encryptOAuthTokens`).
- **Compatibilità**: nessuna migration (le colonne restano `text`); senza chiave si scrive in chiaro come prima; le righe in chiaro si leggono sempre; `pnpm db:encrypt-fields` (prova, poi `--execute`) cifra le vecchie, idempotente. Testato con tutta la suite a chiave accesa.
- **Vincoli**: niente filtri, ordinamenti o GROUP BY in SQL su queste colonne (IV casuale): gli esempi per l'assistente AI ora si raggruppano in memoria sugli ultimi 5.000 movimenti. Una volta attiva, la chiave non va persa né cambiata e non si torna a immagini precedenti.
- **Infra**: Secret facoltativo `app-data-encryption`, script `crea-chiave-dati.sh`, CronJob sospesi `encrypt-fields(-prova)`, runbook `docs/runbooks/cifratura-dati.md` nel repo infra.
- **Rimandato**: cifratura del disco della VPS (su un solo server o si digita la chiave a ogni riavvio, o la si tiene sullo stesso disco); rotazione della chiave.
