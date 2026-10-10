# Form a passi: una domanda alla volta (2026-10-10)

- **Decisione**: i form lunghi diventano percorsi lineari, un passo alla volta, con «Passo X di N», «Indietro» sempre disponibile e focus sul primo campo del passo. Componenti comuni in `components/domain/shared/step-flow.tsx` (`useStepFlow`, `StepProgress`, `StepStage`, `StepHeading`, `StepActions`); transizione con `motion` (già adottato), molle di `lib/motion/springs`, solo dissolvenza con il movimento ridotto.
- **Prima PR**: onboarding (valuta, poi conferme legali) e nuovo conto manuale (nome e tipo, poi saldo con icona e colore facoltativi). Le conferme legali restano tre, invariate.
- **Rimandati** (PR successive): movimento, operazione di investimento, import, debiti, pensione, segnalazioni.
- **Osservabilità**: eventi Umami `form_step_completed` e `form_step_back` (`flow`, `step`); nessun nuovo log o metrica lato server.
