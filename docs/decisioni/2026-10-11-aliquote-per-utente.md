# 2026-10-11 — Aliquota e armonizzazione sono sempre per utente

- **Problema**: creando uno strumento comune (Yahoo, ISIN) l'aliquota e l'armonizzazione scelte finivano sulla riga condivisa `instruments` e, senza una correzione personale, valevano per tutti gli utenti che usavano quello strumento.
- **Decisione**: per gli strumenti comuni la scelta fatta alla creazione si salva in `user_instrument_settings` dell'utente; il calcolo (`resolveTaxSettings`) ignora i valori fiscali della riga condivisa e usa quelli solo per gli strumenti manuali (privati). Nessuna migration: i vecchi valori restano nel DB ma non si leggono più.
- **Effetto**: chi aveva scelto un'aliquota diversa creando uno strumento comune la rivede in automatico (26%, o 12,5% per i titoli di Stato riconosciuti dal nome) finché non la reimposta dalle impostazioni dello strumento.
- **Test**: `lib/investments/instruments-tax-isolation.integration.test.ts`, `lib/calc/taxes.test.ts`.
