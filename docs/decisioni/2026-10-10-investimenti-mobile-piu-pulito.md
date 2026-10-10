# Investimenti su mobile: meno rumore, periodo sotto i grafici, via il confronto tra broker

**Data**: 2026-10-10

- Su mobile (< 640 px) nel Portafoglio il grafico segue subito valore e variazione del giorno; la lettura in parole, la barra e i toggle «Rimetti costi/imposte» passano sotto il grafico e il selettore del periodo. Su desktop nulla cambia.
- In Performance, su mobile (< 1024 px) il selettore del periodo sta sotto i grafici (prima della heatmap); su desktop resta in alto.
- Rimosso «Confronto tra broker» (card, `lib/investments/broker-comparison.ts`, stato `overlay`, evento Umami `investment_broker_overlay_changed`, test). Il filtro «Broker inclusi» resta. Nessun impatto su catalogo e landing.
