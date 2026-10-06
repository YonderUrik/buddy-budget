# Periodi del grafico portafoglio

- Aggiunti YTD (1 gennaio–oggi) e intervallo personalizzato inclusivo, con conferma Applica e validazione delle date.
- La ricostruzione conserva tutte le operazioni precedenti: cambia solo il periodo del grafico, non il saldo attuale, la composizione o le stime fiscali.
- YTD e intervalli personalizzati mantengono punti giornalieri, compresi gli estremi e gli intervalli di un solo giorno; costi e imposte reinvestiti restano allineati alla data.
- Ambito attuale: grafico della scheda Portafoglio. Gli altri selettori mantengono i periodi esistenti.
- Evento Umami `investment_chart_period_changed` con solo categoria del periodo, senza date o importi. Nessuna nuova API o dipendenza esterna.
- Catalogo e screenshot della landing aggiornati; test dei limiti calendario e della conservazione delle posizioni precedenti, verifica browser desktop/mobile con dati sintetici.
