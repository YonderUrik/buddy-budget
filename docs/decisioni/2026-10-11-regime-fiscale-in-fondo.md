# 2026-10-11 — Regime fiscale: da sezione a riga in fondo alla scheda Tasse

- **Richiesta**: Daniele trovava la sezione «Regime fiscale» inutile perché sembrava non cambiare nulla.
- **Verifica**: il regime è usato da `computeTaxReport` (compensazione delle minusvalenze evento per evento in amministrato, netto annuo in dichiarativo; momento in cui contano le pregresse), da `estimatedTaxCharges` (data delle imposte nell'«Impatto imposte» del Portafoglio) e dalle scritte di «Quest'anno» e «Prima di vendere». I numeri divergono solo se nello stesso anno una plusvalenza precede una minusvalenza, per questo sembra inerte. Analitiche e email di riepilogo non lo usano.
- **Decisione**: tolta la sezione in alto a destra; la scelta resta come riga compatta in fondo alla scheda (con l'avvertenza sulle stime e un «i» che spiega i due regimi), perché IBKR e DEGIRO sono di norma in dichiarativo. Colonna `tax_regime`, API ed evento Umami invariati.
