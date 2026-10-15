# 2026-10-10 — Animated effects: text, numbers and springy transitions

After analysing React Bits, Aceternity, Motion Primitives and Animate UI, Daniele chose a mix of animated text and change effects, **without light effects** (glowing borders, glows, confetti: "troppo cringe", "too cringe").
- Shared components in `components/motion/` (barrel): `AnimatedNumber` (NumberFlow), `TextMorph` (also inside every `Button` with text), `BlurText`, `TextShimmer`, `AnimatedList`, `MotionProvider` (`reducedMotion="user"`). Shared springs in `lib/motion/springs.ts`.
- Applied to: large figures (`MoneyHero`), the Panoramica greeting, tabs and segmented controls (sliding indicator), dialog that grows from the pressed button, year/text of Analitiche, dark sync island (instead of the panel).
- `InvestmentsTabs` now uses `SectionTabs` (debt of the duplicated copy closed).
- Landing: the hero title is a changing question («Sai quanto ti resta a fine mese?» — "Do you know how much you have left at the end of the month?" —, taxes on ETFs, pension, pension fund, debts) and the closing answers «Sai sempre…» ("You always know…") with a changing sentence (GSAP; `WordLoop` with `stacked` keeps the height fixed).
- MIT libraries only (attributions in `NOTICE`); React Bits and Animate UI (Commons Clause) and Aceternity (proprietary) excluded.
