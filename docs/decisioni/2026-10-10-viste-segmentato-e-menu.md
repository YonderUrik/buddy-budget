# 2026-10-10 — Views of a section: segmented control on desktop, menu on mobile

Daniele asked whether tabs were the best solution (thread «Navigazione tra le viste», "Navigation between views") and chose proposal B among three alternatives (A improved tabs, B compact selector, C single «Analisi» with an index).
- `SectionTabs` remains the only component of Investimenti, Liquidità and Pensione, with the same real links (one URL per view): from `lg` it is a segmented control with a sliding background (`SPRING_BOUNCY` spring), below `lg` a menu «Portafoglio · 1 di 6» ("Portfolio · 1 of 6") with a description row per item (`SectionTab.description`).
- Reason: on phone Investimenti had 6 tabs and three and a half were visible, Tasse and Operazioni hidden without hints.
- No change to URLs, tracking or data. Postponed: chart period shared between views (today it resets at every change), generic Umami event `section_tab_viewed` (today only Liquidità has `liquidity_tab_viewed`), considering merging Dividendi and Tasse.
