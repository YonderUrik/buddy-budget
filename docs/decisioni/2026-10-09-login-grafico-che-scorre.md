# 2026-10-09 — Login: il grafico scorre come un nastro

- **Decisione**: il grafico del patrimonio nel login non si trasforma più tutto insieme a ogni movimento: ha una scala fissa e una finestra di 24 periodi che scorre verso sinistra, con un punto nuovo che entra da destra e i vecchi che escono. I punti annotati (Primo investimento, Rata del mutuo pagata, Stipendio e risparmio) scorrono con la linea e sfumano ai bordi.
- **Dati di esempio**: la serie è una funzione continua e limitata del periodo (`login-horizon.model.ts`), non più la finestra del mosaico; numero grande e variazione seguono l'ultimo periodo e possono anche scendere.
- **Reduced motion**: resta ferma sulla finestra iniziale.
- **Rimandato**: `login-mosaic.model.ts` resta solo per i propri test; da eliminare se non serve più.
