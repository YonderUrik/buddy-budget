# 2026-10-11 — Nell'app scorre solo <main>

- `html` e `body` non scorrono mai quando c'è la shell dell'app (`:has(#main-content)`): una seconda barra accanto a quella di `<main>` non può più comparire per un documento più alto della finestra. Login, landing e pagine pubbliche non cambiano.
- `<main>` non scorre di lato (`overflow-x: hidden`): un elemento che sborda non apre una barra orizzontale.
- Causa trovata su mobile: la testata di Investimenti (titolo + tre pulsanti con etichetta) era più larga dello schermo. Ora su mobile i pulsanti sono solo icone, come «Aggiungi» in Liquidità.
- Tolta la scritta «Prezzi di chiusura aggiornati ogni sera».
