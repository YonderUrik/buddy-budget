# Transizioni della navigazione (2026-10-11)

Richiesta di Daniele: cambio di sezione più fluido nella sidebar desktop e nella barra in basso su mobile.

- **Indicatore che scivola**: lo sfondo della voce attiva è un solo `motion.span` con `layoutId` (molla `SPRING_SNAPPY`) che si sposta da una voce all'altra, come nelle schede (`SegmentedControl`). Ogni sidebar ha il suo `LayoutGroup`, così quella desktop e quella del menu mobile non si contendono la pillola.
- **Si muove al tocco**: `usePendingNavHref` sposta l'indicatore appena si tocca la voce, senza aspettare la pagina nuova; torna al percorso reale appena questo cambia.
- **Contenuto**: `SectionTransition` in `AppShell` fa entrare la nuova sezione con una dissolvenza di 200 ms e 4 px di scorrimento. Solo in entrata (la pagina vecchia sparisce subito), mai alla prima apertura né tra le schede di una stessa sezione; spenta con il movimento ridotto.
- Scartato `<ViewTransition>` di React: animerebbe anche l'uscita e ritarderebbe la comparsa della pagina nuova.
- Prestazioni: `motion` era già nel bundle comune (`MotionProvider` nel layout radice), nessun JS in più.
