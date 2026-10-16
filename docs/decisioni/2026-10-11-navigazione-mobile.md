# Navigation on phone: views from the title and a single «back» button (2026-10-11)

**Section views.** Below 1024 px the «Movimenti · 1 di 5» dropdown menu (PR #271) is replaced by the page title: the section name in small type, below it the current view «Movimenti ⌄», which opens a bottom sheet with all views and descriptions (`SectionHeading` + `SectionViewsSheet` in `components/domain/shared`). Daniele's choice (proposal B) among scrolling chips, title-selector and sheet from the bottom bar: it frees a row and uses the same sheet as the rest of the app; changing view still takes two taps. From 1024 px up the segmented control remains. Umami events `section_views_opened` and `section_view_chosen`. Mockups and analysis in the thread «Navigazione mobile».

**Back button.**

Child pages (Categorizza, Importa da CSV, debt detail, security page, Impostazioni group on phone, Conti trovati after linking the bank) had five different ways back: 32 px icon only, underlined text «← Torna a…» ("← Back to…"), arrow or chevron, with or without a 44 px touch area. Now they all use `BackLink` (`components/domain/shared`): «‹ Nome della pagina madre» ("‹ Parent page name"), above the title, 44 px touch area, same colour.

Going back always leads to the parent page («up» navigation, not history). Where the section header repeated the name right above the back link (Debiti, Impostazioni on phone) the header is no longer shown. In Impostazioni, «‹ Impostazioni» after opening a group from the list goes back in history: the phone's back button does not reopen the group just closed.

Postponed: the phone's back button closing sheets and dialogs instead of changing page (today only the «Altro» menu does it); the chip row as a shortcut.
