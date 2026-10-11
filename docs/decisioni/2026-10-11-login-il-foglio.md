# 2026-10-11 — Pagina di accesso «Il foglio»

Daniele trovava il login (patrimonio d'esempio con grafico, PR #232/#236) già visto. Tra tre direzioni ha scelto «Il foglio», che continua l'apertura della landing: le pagine di accesso sono un foglio di calcolo, con barra della formula (`=ACCEDI("email")` mentre si scrive), colonne e righe numerate, l'email come cella selezionata B6 e schede in basso («Cosa c'è dentro», «Novità», «In arrivo») che cambiano la tabella a destra. Novità e arrivi vengono dal catalogo `lib/features`, quindi non si aggiornano a mano.

Componenti in `components/domain/auth` (`AuthSheet`, `AuthSheetTable`, `useSheetFormula`); tolti `LoginHorizon`, mosaico, ticker «In arrivo» e nota della novità. Nuovo token `--highlight` (evidenziatore) ed evento Umami `login_sheet_tab_selected`.

Rimandati: formula propria per onboarding e accettazione dei Termini (oggi `=BENVENUTO()`), prova su Safari/iPhone.
