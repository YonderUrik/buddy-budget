# 2026-10-10 — Effetti animati: testi, numeri e transizioni elastiche

Dopo l'analisi di React Bits, Aceternity, Motion Primitives e Animate UI, Daniele ha scelto un mix di testi animati ed effetti di cambio, **senza effetti di luce** (bordi luminosi, bagliori, coriandoli: "troppo cringe").
- Componenti condivisi in `components/motion/` (barrel): `AnimatedNumber` (NumberFlow), `TextMorph` (anche dentro ogni `Button` con testo), `BlurText`, `TextShimmer`, `AnimatedList`, `MotionProvider` (`reducedMotion="user"`). Molle comuni in `lib/motion/springs.ts`.
- Applicati a: cifre grandi (`MoneyHero`), saluto della Panoramica, schede e controlli segmentati (indicatore che scivola), dialog che cresce dal pulsante premuto, anno/testo di Analitiche, isola scura dei sync (al posto del pannello).
- `InvestmentsTabs` ora usa `SectionTabs` (chiuso il debito della copia duplicata).
- Landing: titolo della hero che emerge per parole (solo CSS) e frase della chiusura che cambia (GSAP).
- Solo librerie MIT (attribuzioni nel `NOTICE`); React Bits e Animate UI (Commons Clause) e Aceternity (proprietaria) esclusi.
