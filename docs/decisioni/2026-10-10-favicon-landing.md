# 2026-10-10 — Favicon della landing per Google

Diagnosi: la landing è online e indicizzabile (nessun noindex, robots e sitemap corretti), ma `/favicon.ico` rispondeva 404 e l'unica icona era un SVG non quadrato (viewBox 378×464).
Scelta: `favicon.ico` (48/32/16), PNG 48/96/192, SVG reso quadrato e `<link rel="icon">` espliciti, come chiede Google (quadrata, lato multiplo di 48 px).
Limite: Google aggiorna la favicon solo alla scansione successiva, da giorni a qualche settimana; non si può forzare.
