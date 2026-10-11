# 2026-10-11 — La ricerca strumenti non elenca più il catalogo comune

- **Problema**: in Investimenti, «Cerca un titolo» elencava tra i «già aggiunti» tutti gli strumenti comuni del catalogo, compresi quelli aggiunti solo da altri utenti. Nessun dato personale (quantità, importi, operazioni), ma si vedeva cosa avevano cercato e aggiunto gli altri.
- **Decisione**: il catalogo comune resta condiviso per i prezzi (ISIN, ticker, storico), ma `searchKnownInstruments` restituisce solo strumenti legati all'utente: creati da lui, con sue operazioni, in watchlist, con un suo avviso o sue impostazioni. Gli altri si trovano dalle fonti di mercato e si riusano.
- **Test**: `lib/investments/instruments-search.integration.test.ts`.
