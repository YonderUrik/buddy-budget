# 2026-10-18 — Guidance after onboarding

A new user landing in Panoramica now always knows the next thing to do.

- **One question in onboarding**: «Cosa vuoi tenere sotto controllo?» (spending, investments, mortgage and loans, pension fund; several or none). Saved in `auth_user.start_focus` (migration 0042). It decides the «Primi passi» steps: the account always first, the target (or a category budget in Germany) always last, the others from the answer. No answer keeps the original four, so existing users see no change. «Cambia cosa vuoi tenere sotto controllo» under the checklist reopens the question.
- **One next step**: the first step not done stands alone in a filled block with one yellow action; the others follow as a short list. With nothing real yet, «Prima prova con dati d'esempio» sits beside it (the separate sample-data section is gone).
- **Each step leads to the next**: a step done anywhere in the app shows a toast with what it did and the next step's action; Panoramica says it on the next-step block instead. The end shows «Primi passi completati». Every successful write refreshes the steps while they are incomplete (`MutationCache` in `QueryProvider`), and so do finished imports and syncs.
- **Empty tabs explain themselves**: Movimenti, Analisi and Abbonamenti in Liquidità, before the first account, say what they will show and offer «Aggiungi un conto» or «Importa un file» instead of zeros and empty charts.
- **Less noise for a new user**: no «finora hai speso 0 €», no «Novità» released before the user signed up, no goals invite while the checklist is on screen, no FIRE hint in the sidebar with nothing recorded yet.

Why: Daniele found the home after onboarding left people without a clear start. Ideas came from common activation patterns (one next step, a short intent question, chained steps, useful empty states); product tours and early reminder emails were left out on purpose (tours get skipped; emails are all opt-in).

Observability: Umami `onboarding_focus_chosen`, `start_focus_changed`, `start_step_completed`, `start_step_clicked` with `placement` (hero, list, toast), `empty_state_action_clicked`; log `onboarding.focus.updated` (`trigger` onboarding or checklist, `count`); metric `start_events_total{event="focus_changed"}`.

Deferred: deep links that open the add forms in Debiti and Investimenti directly, steps after the checklist (categorise, first budget review).
