# Germania: costi degli investimenti

Seconda fase del rollout dopo l'inflazione. La vista Investimenti tedesca mostrava già commissioni e imposte registrate senza stime fiscali italiane; nessuna nuova pagina o abilitazione di Analitiche/FIRE è necessaria in questa fase.

## Modifiche

Il calcolatore condiviso dei costi annui ora richiede esplicitamente il paese. Il registro finanziario mantiene il bollo italiano già esistente per IT (0,2%) e non applica questo prelievo per DE. Un paese sconosciuto o omesso non ricade implicitamente sull'Italia. Il TER resta separato dai prelievi nazionali; importi, nomi e movimenti salvati restano invariati. Le tre viste Analitiche passano il paese esplicitamente, ma restano inaccessibili per DE fino alla fase FIRE.

Nel portafoglio il pannello spiega che i costi del fondo sono già riflessi nel prezzo, non vengono sottratti nuovamente e non sono commissioni registrate. Eventuali costi del broker non registrati non sono inclusi. Per DE si mostrano soltanto costi e imposte registrati, senza bollo italiano e senza stime fiscali tedesche. Questo non afferma che il conto sia esente da imposte o commissioni del broker.

Corretto un difetto della simulazione «Rimetti i costi»: il testo mostrava `{0}` anziché l'importo pagato. Ora i due importi sono formattati con i centesimi nella lingua corrente; lo stato accessibile della simulazione è tradotto. Gli effetti ipotetici rimangono distinti dagli importi pagati e non modificano le operazioni.

## Fonti verificate il 14 ottobre 2026

- BaFin, costi coperti dal patrimonio del fondo e possibili commissioni di deposito: https://bafin.de/DE/verbraucherinnen-verbraucher/themen-finanzprodukte/geldanlage/wertpapiere/offene-immobilienfonds/offene-immobilienfonds.html
- iShares, TER e prelievo giornaliero delle commissioni dal fondo: https://www.ishares.com/de/professionelle-anleger/de/wissen-service/etf-faq

Non sono state introdotte aliquote fiscali tedesche. La fiscalità di base resta la fase successiva, con verifica delle norme per anno.

## Verifica in produzione dopo approvazione

Con paese Germania e lingua inglese/tedesca, aprire Investimenti e «Costi e imposte»: importi uguali ai costi registrati, nessun segnaposto, nessuna stima fiscale aggiuntiva. Attivare i due interruttori separatamente e insieme; tornare allo stato originale e verificare che le operazioni non cambino. Con Italia, verificare la continuità della vista fiscale e dei costi annui. I blocchi di pensione e Analitiche per DE devono restare attivi.

Osservabilità: nessun nuovo servizio, job o dato persistito; restano i controlli CI, gli errori delle API esistenti e la verifica browser del calcolo locale. Nessuna migration o deploy richiesto per la prova localhost.

## Esito locale

Build di produzione, TypeScript, lint dei file modificati e catalogo funzioni riusciti. 54 test mirati superati. Suite completa: 2.223 superati, unico errore noto nel logger per il nome della directory locale `/Users/mario`. Browser verificato su DE/en, DE/de, IT/it e IT/en: importi pagati confrontati con le API, nessun `{0}`, entrambi gli interruttori e ritorno allo stato iniziale, movimenti invariati, blocchi tedeschi confermati. Nessun errore browser. Screenshot Portafoglio aggiornati nei due temi; 3 test screenshot superati; preview lasciata in DE/en. Nessun merge/deploy.
