# Rimozione della sezione Pianifica

- Rimossa la voce segnaposto “Pianifica” dalla navigazione e dal catalogo condiviso: non compare più tra le funzioni promesse sul login o sulla landing.
- Il pannello “In arrivo” si nasconde quando non ci sono schermate future e non avvia il timer con meno di due voci.
- Non esisteva una route o un dominio implementato da eliminare; le specifiche storiche restano come riferimento, senza un impegno di rilascio per Pianifica.
- Catalogo landing sincronizzato; screenshot da rigenerare: il tentativo locale con dati demo si ferma su `/panoramica` (HTTP 500, Webpack non risolve `perf_hooks` importato da `prom-client`).
