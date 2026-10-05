# Import IBKR riconciliato (branch locale)

Data: 2026-10-04

Il CSV originale viene riletto sul server e salvato integralmente con il rendiconto. L'import richiede continuità dei periodi e corrispondenza di cassa/quantità; reimport concorrenti sono idempotenti. Spinoff interamente ceduti trasferiscono quote e base senza inventare un acquisto. I valori comunicati da IBKR sono consultabili separatamente dai calcoli a costo medio. Strumenti manuali isolati per utente/ISIN/valuta. Nessun push o PR per richiesta dell'utente; specifica e limiti in [ibkr-import.md](ibkr-import.md).
