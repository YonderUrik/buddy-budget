# DEGIRO nel portafoglio condiviso

Data: 2026-10-04

Import Account.csv italiano con riconciliazione multivaluta, commissioni EUR allocate per ordine e cambio broker quando presente. Origine delle operazioni e associazione conto/broker persistite (migration 0021): aggiornamenti e cancellazioni non coinvolgono l’altro broker anche con date sovrapposte. Conservate tutte le righe originali; nessun NAV o snapshot posizioni inventato. Verificato localmente il file reale insieme ai quattro IBKR; fixture pubblica sintetica. Limiti e controlli in [degiro-import.md](degiro-import.md). Solo branch locale, PR rimandata.
