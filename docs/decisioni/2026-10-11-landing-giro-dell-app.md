# 2026-10-11 — Landing: giro dell'app con schermate intere

Dopo la PR #311 Daniele ha trovato gli screenshot illeggibili (si vedeva solo una porzione), il catalogo «Tutte le 49 funzioni» inutile in home e le pagine interne ancora nello stile vecchio.

- Le cinque sezioni «prima / ora» e la scheda tecnica «Nel dettaglio» diventano **una sola sezione a schede** (`components/tour.tsx`, testi in `TOUR` di `content/sheet.ts`): per area il foglio di prima, cosa fa l'app, **la schermata intera** a tutta larghezza e i dettagli. `ShotCrop` e `ToolShot` (ritagli senza sidebar) sono eliminati: si usa sempre `AppShot`.
- Il catalogo in tabella esce dalla home; resta `/funzioni`, linkata in fondo al giro.
- Fonti supportate con **bandiere** (flag-icons, MIT, `public/flags/ATTRIBUTION.md`) e icone; le regole italiane mostrano la loro icona.
- Le etichette tipo «Spese!A1» diventano titoletti normali: sembravano codice.
- Pagine interne: intestazione sulla griglia del foglio, invito finale in card chiara e piè di pagina chiaro al posto della fascia navy, selettori a pillola come nell'app, raggi dai token.
- Evento Umami `tour_tab_selected` al posto di `detail_tab_selected`. Tolti gli screenshot del credito Lombard (funzione rimossa).

Catalogo sfoltito da 49 a 34 voci (richiesta di Daniele): tolte le voci che erano dettagli d'interfaccia (nomi leggibili, ricerca e note, proposte per somiglianza, conti per banca, aggiornamento, avviso di rinnovo, categoria con un tocco, da sistemare, liquidità unica, rate e correzioni, riepilogo in barra, nascondi importi, accesso, aiuto, installabile). Le funzioni restano nell'app; il catalogo elenca solo quelle che contano da sole.
