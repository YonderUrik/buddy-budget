# 2026-10-10 — Viste di una sezione: segmentato su desktop, menu su mobile

Daniele ha chiesto se le tab fossero la soluzione migliore (thread «Navigazione tra le viste») e ha scelto la proposta B tra tre alternative (A tab migliorate, B selettore compatto, C «Analisi» unica con indice).
- `SectionTabs` resta l'unico componente di Investimenti, Liquidità e Pensione, con gli stessi link veri (un URL per vista): da `lg` è un controllo segmentato con il fondo che scivola (molla di `SPRING_BOUNCY`), sotto `lg` un menu «Portafoglio · 1 di 6» con una riga di descrizione per voce (`SectionTab.description`).
- Motivo: su telefono Investimenti aveva 6 schede e se ne vedevano tre e mezza, Tasse e Operazioni nascoste senza indizi.
- Nessun cambio di URL, di tracciamento o di dati. Rimandati: periodo del grafico condiviso tra le viste (oggi si azzera a ogni cambio), evento Umami generico `section_tab_viewed` (oggi solo Liquidità ha `liquidity_tab_viewed`), valutare di unire Dividendi e Tasse.
