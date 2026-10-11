# 2026-10-10 — Portafoglio: «Costi e imposte» in un pulsante, schede senza barra

- La simulazione «e se costi e imposte fossero rimasti investiti?» non è più un blocco di testo con due interruttori sotto il grafico: è il pulsante «Costi e imposte» accanto al selettore del periodo, che apre un popover con gli stessi due interruttori. Default: simulazione spenta. Con la simulazione accesa il pulsante si tinge e mostra «· 1/2»; la riga «Simulazione · +X €» sotto l'importo resta.
- Evento Umami `investment_reinvest_toggled` invariato.
- Schede di sezione e chip dei conti scorrono di lato senza disegnare la barra (`.scrollbar-hidden`, anche `overflow-y: hidden`): su finestre strette la barra orizzontale delle schede si sommava a quella verticale della pagina.
- Non riprodotto con i dati demo: una seconda barra verticale annidata. Se persiste, serve screenshot/browser per individuarla.
