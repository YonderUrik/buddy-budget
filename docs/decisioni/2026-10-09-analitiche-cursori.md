# Analitiche: cursori «e se…» al posto del solo racconto (2026-10-09)

Dopo il restyling di Panoramica, Liquidità e Pensione, Daniele ha chiesto 3 proposte per Analitiche (mockup in `analitiche-stile/`, cartella del progetto) e ha scelto la **C, «Strumento»**.

- **Cosa cambia**: in cima l'anno in cui si può smettere di lavorare (grande, con la differenza rispetto alle ipotesi salvate), poi quattro cursori (risparmio, spesa, rendimento reale, tasso di prelievo) che provano le ipotesi **senza salvarle**; sotto, quattro schede-risposta (Strada fatta, Arrivo, Regge, Costi) che cambiano il grafico a tutta larghezza. «Salva queste ipotesi» le rende definitive, «Ripristina» le annulla. Le altre ipotesi sono nel dialog «Tutte le ipotesi» (il vecchio pannello, invariato). Niente più indice delle domande né riquadro ipotesi in cima.
- **Stile**: le metriche e i blocchi «Per esperti» perdono i riquadri grigi (filetto sopra, numero grande), come nello standard di Panoramica.
- **Calcolo**: `lib/analitiche/scenario.ts` (puro, testato): estremi dei cursori e anni al traguardo con una sola ipotesi cambiata. La simulazione Monte Carlo segue i cursori con `useDeferredValue` per non bloccare il trascinamento.
- **Eventi** (Umami): `analytics_scenario_changed` (field, a cursore lasciato), `analytics_scenario_reset`, `analytics_scenario_saved` (fields), `analytics_view_selected` (view); `analytics_question_nav` rimosso. Nessuna migration, nessun nuovo log/metrica server.
- **Rimandato**: i dettagli «Per esperti» (schede grafiche delle vecchie sei analisi) restano come prima, salvo i riquadri; «Rischio» come risposta propria; cursori per volatilità e anni di pensione; cursori che partono da una cifra non nota (restano disabilitati finché non c'è la spesa o il risparmio).
