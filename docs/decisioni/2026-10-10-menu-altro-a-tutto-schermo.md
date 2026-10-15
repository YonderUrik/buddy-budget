# Full-screen «Altro» ("More") menu on mobile

Date: 2026-10-10

On mobile, «Altro» in the bottom bar opened the sidebar as a half-screen side panel, with the same items as desktop. Now it opens a full-screen view (`components/layout/mobile-more-menu.tsx`): account at the top (leads to Impostazioni), the sections outside the bar (Pensione, Analitiche) with a row explaining what is inside, «Il tuo quadro» ("Your picture": the same modules as the sidebar, turned on or off from Impostazioni), quick preferences (light/dark/system theme, hide amounts), Esci (Sign out), legal links and version.
It closes with ×, Esc or the phone's back button (on opening a history entry is added and consumed on closing). Rows at least 44 px tall. With the bottom bar turned off in Impostazioni, the hamburger with the previous side panel remains.
My choices, to be confirmed: no new module, and the summary reuses the sidebar style (small for the phone but already readable). Umami event `more_menu_clicked` with `target`.
Postponed: summary modules redesigned for the phone (larger numbers, in Panoramica style), Aiuto (Help) item (there is no page yet), reordering of sections.
