# Pulizia delle requisition GoCardless rimaste senza riga (2026-10-12)

Una diagnosi in produzione mostrava 26 requisition su GoCardless contro 5 note a DB. Due buchi della pulizia giornaliera:
le requisition sconosciute si eliminavano solo con `GOCARDLESS_CLEANUP_DELETE_UNKNOWN` (spento) e dopo 30 giorni, e un
tentativo `pending` che GoCardless dava già `LN` (callback persa) restava per sempre. Ora una requisition sconosciuta è
**nostra** se la sua `reference` è una nostra connessione o il suo URL di ritorno è `<APP_URL>/api/gocardless/callback`:
le nostre mai collegate si eliminano dopo 3 giorni (`stale_requisition`), quelle di altri ambienti restano dietro il flag;
le `LN` sconosciute non si eliminano mai da sole, finiscono nei log una per una (`gocardless.cleanup.linked_unknown`) e si
eliminano solo se approvate per id in `GOCARDLESS_CLEANUP_APPROVED_REQUISITIONS`. Il tentativo `LN` senza conti segue la
grazia delle orfane (7 giorni). Eliminare non libera il posto del mese (lo conta GoCardless), ma tiene pulita la lista.
