# A real «‹ Back» button, fixed at the top on the phone

**Date**: 2026-10-17

A user reported that it is not always clear how to go back to the previous page. Daniele asked for a real «back», not a link to a fixed page (Liquidità → Investimenti → «‹ Liquidità»), placed like in a native mobile app, with the phone as the main focus. The button now lives once in the layout, not on each page. On the phone it sits in the top bar, which is always visible, in place of the brand: «‹ Name of the previous screen», with a large touch target. On desktop it is a row above the page. It leads to the screen the user came from, including between main sections. A second-level page with no known previous screen (first visit, link from an email) falls back to its logical parent. A main section opened directly shows the brand and no button. The history is a short stack in sessionStorage (`lib/navigation/back-history.ts`, recorded by `BackHistoryRecorder`). Settings groups (`?sezione=`) and loans (`?id=`) count as separate screens; other query parameters (filters) do not. The button navigates with a link instead of `history.back()`, so it can never leave the app and its label always matches where it goes. The per-page `BackLink`s were removed. On the landing, internal and legal pages show «‹ Calcolatori/Funzioni/Home» instead of breadcrumbs. Umami events: `back_link_clicked` with `place` (barra/pagina) and `target` (precedente/madre) in the app, `back_link_click` on the landing.

Deferred:
- the phone back gesture closing open sheets;
- restoring the scroll position of the previous screen;
- the desktop row appears after hydration on a hard reload of a main section, a small layout shift only in that case.
