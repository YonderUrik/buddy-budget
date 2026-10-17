# Back link in first view, following the real previous page

**Date**: 2026-10-17

A user reported that, on phone and desktop, it is not always clear how to go back to the previous page. Every second-level page (a page that is not a sidebar or bottom-bar entry) now has the «‹ Name» link above its title, and the link leads to the page the user actually came from when it is a known app page (e.g. «‹ Operazioni» on a security opened from Operazioni), otherwise to the logical parent page as before. The history is a short stack in sessionStorage (`lib/navigation/back-history.ts`, recorded by `BackHistoryRecorder` in the app layout); the link never calls `history.back()`, so it cannot leave the app after a link from an email. Added the link to Aiuto (parent: the `?da=` page or Panoramica), Impostazioni and the country-unavailable page; on the landing, calculators, guides, feature, security and legal pages show «‹ Calcolatori/Funzioni/Home» instead of the small breadcrumbs. Umami: `back_link_clicked` (app) and `back_link_click` (landing).

Deferred: a back link on the main section pages when they are opened from a link inside another page (the sidebar and bottom bar are always visible there); the phone back gesture closing open sheets (see the mobile navigation notes).
