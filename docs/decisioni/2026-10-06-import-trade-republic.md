# Trade Republic: import completo del Transaction export

Aggiunto il provider Trade Republic allo stesso percorso di import dei rendiconti, con riconoscimento automatico e selezione multipla. BUY/SELL alimentano gli investimenti; tutte le righe CASH alimentano Movimenti e il conto di liquidità dedicato, incluse carta, bonifici, interessi e bonus.

La liquidità è ricostruita da amount, fee e tax: l'export non riporta saldi ufficiali o numero conto. Si richiedono storico completo e un solo conto principale per utente. Aggiornamenti, duplicati e cancellazioni sono gestiti insieme ai rendiconti; le categorie e note dei movimenti restano sugli ID già presenti. Nessuna nuova migrazione necessaria.

Dettagli e limiti in [trade-republic-import.md](../trade-republic-import.md). Test sintetici del parser e del ciclo completo su database locale; verifica delle 885 righe dell'export personale senza copiarlo nel repository. Catalogo funzionalità e landing sincronizzati. Eventi e log dell'import esistente includono il nuovo provider; nessuna nuova integrazione esterna.

Il selettore di import usa anche i loghi SVG DEGIRO e Trade Republic al posto delle iniziali, con spazio dedicato ai marchi testuali e sfondo bianco in entrambi i temi. Fonti e attribuzioni in `public/import-providers/ATTRIBUTION.md`; file serviti localmente.
