# Landing «Il foglio» (2026-10-11)

Daniele ha scelto la direzione C fra tre prototipi (A «Il quadro», B «Le domande», C «Il foglio»): la home parte da un foglio Excel con `#VALORE!` che si trasforma nella Panoramica vera, e ogni area è «prima» (la formula che scrivevi) contro «ora» (la schermata dell'app).

- Stile allineato all'app su richiesta di Daniele: stessi neutri, raggi, caratteri (Space Grotesk, Hanken Grotesk, Geist Mono) e pulsanti (primario pieno, secondario con bordo), schede a pillola come quelle dell'app. Del foglio restano la carta a quadretti dell'apertura, le celle in monospace e il giallo della cella selezionata.
- Nuove sezioni: «Funziona con quello che usi già» (loghi di IBKR, DEGIRO, Trade Republic, Fineco, Yahoo; paesi dell'Open Banking), «Scheda tecnica» a schede (banca, categorie, broker, rischio, tasse, debiti, cosa non fa) con fatti verificati nel codice, catalogo completo in tabella filtrabile.
- Tolti: domande in apertura, tre passi, quattro gruppi, mappa dei server. Eventi Umami `question_*` sostituiti da `sheet_view_toggled` e `detail_tab_selected`.
- Rimandato: pagine interne (/funzioni, /strumenti, /guide) prendono font e pulsanti dell'app ma tengono il loro layout; immagine Open Graph da rifare.
