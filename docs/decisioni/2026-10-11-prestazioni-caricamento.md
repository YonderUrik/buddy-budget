# Prestazioni: caricamento, salti di layout e peso dei dati (2026-10-11)

- **Review** delle prestazioni dell'interfaccia (build di produzione con dati demo, 4G lento e CPU 4x): report nel thread «Review performance interfaccia».
- **Fatto**:
  - `app/(app)/loading.tsx`: scheletro al cambio pagina (l'URL cambia in 130-565 ms invece di 0,7-1,1 s).
  - Barrel leggero `components/domain/investments/light.ts`: la sidebar e i moduli di altre aree (Debiti, Liquidità, Abbonamenti) importavano il barrel completo di Investimenti e si portavano dietro tutti i grafici; ora il JS per pagina scende da 600-690 KB a 280-540 KB (stima dal manifest) e la prima chiamata dati parte 1,5 s prima su rete lenta.
  - Liquidità: altezze riservate (CLS 0,44 → 0,05) e una sola richiesta dei movimenti (finestra dell'elenco) invece di due.
  - Storico del patrimonio: `compact=1` riduce le righe oltre 400 giorni all'ultima di ogni mese per classe (è tutto ciò che `buildNetWorthSeries` usa oltre l'anno); `staleTime` di 2 minuti. Panoramica e Liquidità lo usano, Analitiche resta sullo storico completo.
  - Grafici: animazione d'ingresso di Recharts spenta anche nei 9 file che la avevano, come negli altri 10.
- **Rimandato**: `staleTime` globale di `QueryClient` (solo 18 file su 55 che modificano dati invalidano le query), salto di layout di Debiti (0,15, la griglia cresce da 540 a 814 px dopo il primo disegno, causa non isolata), prefetch dei dati sul server, `LazyMotion` (circa 30 KB gzip), Analitiche (TBT 2 s), transizione di pagina con `ViewTransition`.
- **Regola emersa**: un componente di una cartella feature usato da altre aree o dalla sidebar non va esportato solo dal barrel completo se questo trascina grafici; si usa un barrel leggero.
- **Da verificare in produzione**: compressione delle risposte JSON (dal server Node escono non compresse).
