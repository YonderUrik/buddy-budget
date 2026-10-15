# 2026-10-15 — «Funziona con» in schede, con loghi e icone uniformi

**Decisione.** La sezione «Funziona con quello che hai già» della home (`#con`) passa da una fascia grigia a quattro schede con margini, bordo e angoli (`--surface`, `--line`, `--r-card`), sistemate in due colonne che seguono l'altezza del contenuto (sul telefono una colonna, nell'ordine del testo). Ogni scheda ha in testa un'icona lucide in un riquadro tinto (stesso schema delle icone di «La sicurezza, in chiaro») e in fondo: le banche con bandiera e nome del paese; i broker come tessere tutte della stessa altezza su fondo chiaro anche nel tema scuro (i marchi sono pensati per il chiaro), con «CSV di chiunque» come tessera tratteggiata a tutta larghezza; gli strumenti come chip con la fonte dei prezzi (Yahoo Finance, «Tra le fonti dei prezzi») in una riga a parte; il resto con chip.

I chip degli strumenti (condivisi con l'apertura della home) non hanno più le sigle in un tondino ma un'icona nel riquadro del colore dello strumento: `InstrumentChip.code` diventa `icon` (nomi aggiunti a `HomeIcon`: candles, layers, bitcoin, car, spreadsheet) e il colore `navy`, invisibile nel tema scuro, diventa `ink`. Le targhette chiare dei loghi nel tema scuro restano solo nell'apertura (`.with .logo`); nelle schede ogni tessera ha la propria.

**Perché.** Dopo l'unione di #371 Daniele ha segnalato che il box grigio non aveva margini ed era squadrato (era la classe globale `.band`, con sfondo `--bg-alt`, applicata senza padding né raggio) e che le icone di provider e titoli erano brutte (loghi di altezze diverse, Fineco minuscolo, tondini con due lettere).

**Rimandato.** Nulla di nuovo; restano le voci della decisione 2026-10-14 (Open Graph, Safari/iPhone, pagine per domanda).
