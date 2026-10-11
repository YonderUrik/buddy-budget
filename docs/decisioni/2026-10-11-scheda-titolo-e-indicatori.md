# 2026-10-11 — Scheda titolo ripensata e indicatori fondamentali calcolati

- Daniele ha scelto la **pagina unica** (contro le sotto-schede) e, per ora, **solo Yahoo** come fonte (gratis, non ufficiale; proposta e mockup in `scheda-titolo/` nei file del progetto).
- I bilanci arrivano dall'endpoint `fundamentals-timeseries` di Yahoo (esercizi annuali + ultimi 12 mesi), in cache Redis 24 h come i numeri chiave (`lib/market-data/statements.ts`, `loadStatements`). Nessuna migration.
- I multipli (P/E, P/S, P/B, P/FCF, EV/EBITDA) li **calcola l'app** con l'ultima chiusura salvata e i bilanci (`lib/investments/title-fundamentals.ts`), con la forbice degli esercizi passati del titolo stesso; ogni numero ha un «?» con il calcolo. Mai giudizi «caro/conveniente», mai prezzi obiettivo o raccomandazioni degli analisti.
- Se la valuta di bilancio è diversa da quella di quotazione i multipli col prezzo non si calcolano (niente cambi a metà calcolo).
- ETF: primi titoli, settori, multipli medi del paniere (Yahoo li dà invertiti, si correggono), rendimenti anno per anno, costo del TER; per le azioni i fondi posseduti che le contengono.
- Rimandati: SEC EDGAR per le azioni USA (fonte ufficiale), fonti a pagamento (FMP, EODHD: licenza di visualizzazione da chiarire), trimestrali, aree geografiche degli ETF (file emittenti), peso del titolo nel portafoglio (serve il cambio), alert sulla metrica `buddybudget_fundamentals_requests_total` (oggi solo pannello).
