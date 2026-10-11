# CSV personali asincroni

I CSV non supportati usano formati privati e versionati per utente, generati via OpenRouter con modello configurabile.
La coda durevole è in Postgres e viene consumata da un worker separato: eccezione intenzionale al pattern `after()`/Redis, richiesta per isolare CPU e sopravvivere ai riavvii dell’app.
Il codice generato gira in QuickJS/WASM in un processo figlio senza credenziali né API host, con limiti di memoria e timeout esterno.
CSV e anteprime sono cifrati, ogni riga ha un esito visibile e il salvataggio finanziario è atomico solo dopo conferma.
Dettagli, configurazione, limiti e verifiche: [CSV personali](../personal-csv-import.md).
