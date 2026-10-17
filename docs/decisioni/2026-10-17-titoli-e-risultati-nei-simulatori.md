# 2026-10-17 — Tall titles and big answers inside simulators and calculators

Follow-up to `2026-10-17-landing-navy-dopo-hermes.md`: Daniele asked to carry the new style everywhere, inside the simulators and calculators too.
App: every section title (the heading next to a section's icon, empty states, step forms, debt and security names) uses the display face via `SECTION_TITLE`/`PAGE_TITLE` in `components/domain/shared`. A simulator's answer is the new `SimulationResult`: a short label, the result as a big figure in the Panoramica number style (Space Grotesk, never the condensed face, so figures stay readable) and one line of context. Used by «Più ogni mese» and «Surroga» on loans and «Prima di vendere» in Tasse. «Estinzione anticipata» is the loan page's yellow main action.
Landing: content-page h2, calculator card titles and legal section titles use the display face; the calculators' key figure is larger and in ink instead of teal.
Not changed: sliders, charts and the Analitiche answers, which already show one big figure.
