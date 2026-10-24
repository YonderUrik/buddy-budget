# Desktop sidebar as islands (2026-10-24)

Daniele asked for style-only alternatives of the desktop sidebar (same items and modules), possibly as a separate card, with a hover that moves from item to item with a slight lag. Three directions were shown from the real app with hover videos (a floating card, islands, a navy card); he chose the islands, asked for a lighter account card and a clearer middle area, and picked one card per summary module (B2) over a single «In breve» card (B1).

- Menu, each summary module (Oggi, Prossime scadenze, Obiettivo FIRE, Portafoglio, Watchlist) and the account are separate cards with 12 px between them; a module turned off in Impostazioni simply has no card.
- The account card is one row: avatar and first name (opens the account menu, which now also shows the e-mail and the build version), «Scrivici» and collapse as icon buttons.
- Active item: yellow pill sliding between items. Hover: a grey pill behind the list that stretches towards the new item and pulls its trailing edge after it (`HoverHighlight`, `components/motion`), no glow, instant under reduced motion.
- Desktop only: the phone drawer (bottom bar off) keeps the single panel; the bottom bar is untouched.

Rejected: the floating card (A) and the navy card (C); a single titled «In breve» card (B1), which read less clearly than one card per module.
