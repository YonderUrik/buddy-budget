# 2026-10-11 — In the app only <main> scrolls

- `html` and `body` never scroll when the app shell is present (`:has(#main-content)`): a second scrollbar next to `<main>`'s can no longer appear for a document taller than the window. Login, landing and public pages do not change.
- `<main>` does not scroll sideways (`overflow-x: hidden`): an overflowing element does not open a horizontal scrollbar.
- Cause found on mobile: the Investimenti header (title + three labelled buttons) was wider than the screen. Now on mobile the buttons are icons only, like «Aggiungi» ("Add") in Liquidità.
- Removed the text «Prezzi di chiusura aggiornati ogni sera» ("Closing prices updated every evening").
