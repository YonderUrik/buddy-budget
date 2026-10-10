# 2026-10-10 — Effetti animati: testi, numeri e transizioni elastiche

Dopo l'analisi di React Bits, Aceternity, Motion Primitives e Animate UI, Daniele ha scelto un mix di testi animati ed effetti di cambio, **senza effetti di luce** (bordi luminosi, bagliori, coriandoli: "troppo cringe").
- Componenti condivisi in `components/motion/` (barrel): `AnimatedNumber` (NumberFlow), `TextMorph` (anche dentro ogni `Button` con testo), `BlurText`, `TextShimmer`, `AnimatedList`, `MotionProvider` (`reducedMotion="user"`). Molle comuni in `lib/motion/springs.ts`.
- Applicati a: cifre grandi (`MoneyHero`), saluto della Panoramica, schede e controlli segmentati (indicatore che scivola), dialog che cresce dal pulsante premuto, anno/testo di Analitiche, isola scura dei sync (al posto del pannello).
- `InvestmentsTabs` ora usa `SectionTabs` (chiuso il debito della copia duplicata).
- Landing: il titolo della hero è una domanda che cambia («Sai quanto ti resta a fine mese?», tasse sugli ETF, pensione, fondo pensione, debiti) e la chiusura risponde «Sai sempre…» con una frase che cambia (GSAP; `WordLoop` con `stacked` tiene ferma l'altezza).
- Solo librerie MIT (attribuzioni nel `NOTICE`); React Bits e Animate UI (Commons Clause) e Aceternity (proprietaria) esclusi.
