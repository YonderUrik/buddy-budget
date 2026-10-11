# 2026-10-11 — Nessuna scelta di un utente vale per gli altri sugli strumenti comuni

- **Problema**: la tabella `instruments` è condivisa (prezzi, dividendi e profili valgono per tutti), ma aliquota, armonizzazione, nome, tipo e legame ISIN↔simbolo di uno strumento comune li decideva il primo utente che lo creava, e valevano per tutti.
- **Decisione**:
  - aliquota e armonizzazione scelte creando uno strumento comune vanno in `user_instrument_settings` dell'utente; `resolveTaxSettings` usa i valori della riga solo per i manuali (privati);
  - per uno strumento Yahoo nome e tipo vengono dalla fonte (`chart` di Yahoo), valuta e borsa già prima; l'ISIN indicato dal client si lega solo se OpenFIGI conferma quel simbolo;
  - uno strumento creato «solo da ISIN» (nome, tipo e valuta non confermati da nessuna fonte) nasce privato di chi lo crea, con prezzi automatici;
  - l'abbinamento per nome nell'import cerca solo tra gli strumenti dell'utente.
- **Dati esistenti**: nessuna migration. Le aliquote salvate sulle righe comuni non si leggono più (chi le aveva scelte le reimposta dalle impostazioni dello strumento); nomi, tipi e ISIN già salvati sulle righe comuni restano finché non si decide una pulizia.
- **Test**: `lib/investments/instruments-shared-isolation.integration.test.ts`, `lib/calc/taxes.test.ts`, `app/api/instruments/route.test.ts`.
