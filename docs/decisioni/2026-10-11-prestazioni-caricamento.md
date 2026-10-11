# Prestazioni: stato di caricamento, salti di layout e cache dello storico (2026-10-11)

- **Review** delle prestazioni dell'interfaccia (misure su build di produzione con dati demo, rete 4G lenta e CPU 4x): report nel thread «Review performance interfaccia».
- **Fatto in questa PR**: `app/(app)/loading.tsx` (scheletro al cambio pagina: l'URL cambia in 130-565 ms invece di 0,7-1,1 s), altezze riservate in Liquidità (CLS 0,44 → 0,06) e `staleTime` di 2 minuti sullo storico del patrimonio (401 KB nel demo).
- **Rimandato**: `staleTime` globale di `QueryClient` (solo 18 file su 55 che modificano dati invalidano le query: serve prima un giro sulle invalidazioni), salto di layout di Debiti (0,15, la griglia cresce da 540 a 814 px dopo il primo disegno, causa non isolata), storico ridotto lato server, code splitting di Recharts e Motion, prefetch dei dati sul server, Analitiche (TBT 2 s), animazioni d'ingresso dei grafici ancora attive in 9 file su 19, transizione di pagina con `ViewTransition`.
- **Da verificare in produzione**: compressione delle risposte JSON (dal server Node escono non compresse).
