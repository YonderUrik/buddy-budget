# Aggiornamento a main — 11 ottobre 2026

Base integrata: `8150dfb` (scroll unico e correzione overflow mobile).

Manteniamo PanelSection, layout desktop 3/5 + 2/5, scala del rischio, heatmap aperta e dialog standard di main. Non ripristiniamo il confronto broker rimosso da main. Su mobile i rendimenti rimangono in due colonne, i popover diventano fogli dal basso e i benchmark usano il form dialog a tutto schermo.

Verifica Chrome sull’app reale e database demo isolato:
- desktop 1440×726, chiaro/scuro;
- mobile 390×844: larghezza documento 390 px, nessun overflow; popup largo 390 px e ancorato al fondo;
- salvataggio MSCI World dai suggerimenti e successivo aggiornamento dei prezzi;
- anteprima grafico al 28 agosto e trascinamento 24 luglio–21 settembre;
- ripristino del periodo, coerenza delle date di rischio e heatmap.

Le immagini sono dati fittizi. Il seed demo è stato allineato ai campi introdotti da main; la suite di integrazione gira separatamente su un database nuovo.

Controlli: TypeScript ed ESLint sui file modificati passano. Suite completa su DB nuovo: 2043 test superati, uno fallisce in `lib/observability/logger.test.ts:66`, identico a main: cerca la stringa `mario` nello stack e trova il percorso locale `/Users/mario/`. I test mirati di performance, rischio e intervalli passano (83).
