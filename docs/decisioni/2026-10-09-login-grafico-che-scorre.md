# 2026-10-09 — Login: il grafico scorre come un nastro

- **Decisione**: il grafico del patrimonio nel login non si trasforma più tutto insieme a ogni movimento: ha una scala fissa e una finestra di 24 periodi che scorre verso sinistra, con un punto nuovo che entra da destra e i vecchi che escono. Niente punti annotati: solo la linea con l'etichetta sul punto finale.
- **Dati di esempio**: la finestra iniziale è deterministica (stessa su server e browser, niente errori di idratazione); i periodi nuovi sono una passeggiata casuale che torna verso la media e resta entro limiti fissi (`login-horizon.model.ts`), quindi mai fuori scala. Numero grande e variazione seguono l'ultimo periodo e possono anche scendere. La linea non sale sopra il form su desktop.
- **Reduced motion**: resta ferma sulla finestra iniziale.
- **Rimandato**: `login-mosaic.model.ts` resta solo per i propri test; da eliminare se non serve più.
