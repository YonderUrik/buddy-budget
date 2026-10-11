# 2026-10-11 — La ricerca strumenti non elenca più il catalogo comune

- **Problema**: in Investimenti, «Cerca un titolo» elencava tra i «già aggiunti» tutti gli strumenti comuni del catalogo, compresi quelli aggiunti solo da altri utenti. Nessun dato personale (quantità, importi, operazioni), ma si vedeva cosa avevano cercato e aggiunto gli altri.
- **Decisione**: il catalogo comune resta condiviso per i prezzi (ISIN, ticker, storico), ma `searchKnownInstruments` restituisce solo strumenti legati all'utente: creati da lui, con sue operazioni, in watchlist, con un suo avviso o sue impostazioni. Gli altri si trovano dalle fonti di mercato e si riusano.
- **Test**: `lib/investments/instruments-search.integration.test.ts`.

## Audit di isolamento (stessa PR)

Audit di tutte le 105 route e delle funzioni `lib/**` su tabelle utente: nessun accesso trasversale a dati per utente. Corretti: callback GoCardless filtrata per utente; finalize GoCardless accetta solo conti della requisition della connessione; stato backfill solo per strumenti visibili; cache del commento AI per utente (i prezzi manuali di un utente non finiscono nel testo di altri); logout con ricarica completa (cache TanStack svuotata). Aperto: nome, tipo e aliquote degli strumenti comuni creati da Yahoo/ISIN arrivano dal client (decisione da prendere).
