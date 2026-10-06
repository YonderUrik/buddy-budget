# Panoramica con una voce (direzione A, rivista)

Data: 2026-10-06

Scelta la direzione A tra 4 proposte (mockup in `/mnt/project-files/panoramica/`; B e D restano idee per dopo). Dopo la prima versione a tessere uguali, Daniele l'ha trovata senza identità: la Panoramica ora si apre con un saluto e 2-3 frasi calcolate (mese contro il solito, prossima rata entro 14 giorni, movimenti da categorizzare), il grafico del patrimonio resta l'unico riquadro, e le altre parti sono sezioni aperte sulla pagina (mese con curva cumulata contro il solito, «Da sistemare», prossime rate come agenda, investimenti con barra versato/guadagno), ognuna con icona nel colore del suo ambito.
Accessibilità: testo minimo 14 px, bersagli da 44 px, grafici con `role="img"` e descrizione, curva animata solo senza «riduci movimento», segni +/− e icone oltre al colore. Nuovo evento Umami `overview_tile_clicked`. Rimossa la card «Questo mese» a tre cifre. Nessuna migration. Screenshot della landing da rigenerare dal bot dopo il merge.
