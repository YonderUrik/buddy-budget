# 2026-10-11 — Landing: il foglio diventa l'app, e pesa meno sul telefono

- Nell'apertura il passaggio da «Foglio1» a «BuddyBudget» parte dalla cella del totale (B12, `#VALORE!`): la Panoramica si allarga da lì fino a coprire il foglio, mentre le righe si spengono una dopo l'altra. Solo `clip-path` e opacità, niente sfocature o ingrandimenti su livelli grandi.
- Le schede in basso sono più alte (40 px), sopra il resto, e «BuddyBudget» ha il colore del marchio quando non è attiva; la pausa del giro automatico vale solo col mouse (sul telefono il tocco non ha un «uscire» e il giro restava fermo).
- Gli screenshot hanno una versione leggera a 1280 px (`<id>-sm.jpg`, generata da `capture:screens`) scelta con `srcset` sui telefoni: Daniele segnalava la pagina che si chiudeva da sola sul telefono, non riprodotto su Chromium, quindi si riduce memoria e lavoro grafico.
