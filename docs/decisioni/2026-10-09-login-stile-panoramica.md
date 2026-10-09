# 2026-10-09 — Login nello stile della Panoramica («Orizzonte»)

- **Decisione**: la pagina di accesso (e le pagine che condividono il layout `(auth)`: accetta-termini, onboarding, account disattivato) abbandona il pannello diviso con il mosaico di tessere. Scelta tra tre mockup la direzione A «Orizzonte»: il patrimonio netto di esempio è un numero grande con decimali attenuati e un grafico a tutta larghezza sul fondo della pagina; il form sta a sinistra; le sei aree dell'app sono una fila di icone tinte sotto il grafico.
- **Una sola linea**: il grafico mostra solo il patrimonio netto, con etichetta diretta sul punto finale (nessuna legenda). Le due linee dei mockup, non spiegate, sono state tolte. Il numero e l'ultimo punto seguono i movimenti di esempio (`useMosaicLive`); con `prefers-reduced-motion` resta fermo.
- **Rimosso**: le tessere `mosaic-*` (le rimpiazzano `LoginHorizon`, `LoginAreas`). Il modello dei dati di esempio (`login-mosaic.model.ts`) resta.
- **Invariato**: testi del form, accesso con link via email e Google, logo → landing, «Nuovo» e «In arrivo».
- **Rimandato**: nessuna schermata di login nella landing, quindi nessun impatto su catalogo e screenshot.
