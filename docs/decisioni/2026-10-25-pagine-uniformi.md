# Same page column everywhere, blocks as islands (2026-10-25)

After the desktop sidebar became islands, Daniele found the pages uneven: blocks without a clear separation and charts breaking oddly at some window widths. An audit of every app page at 1024, 1280, 1440 and 1920 px found three causes:

- Hero charts (net worth, Liquidità, Analisi, portfolio, pension) and the Operazioni month bands bled 24 px past the page column (`-mx-6`). Against the old full-height navy sidebar that read as edge to edge; next to the floating islands they touched the menu card on one side and the window edge on the other, while the rest of the page stopped elsewhere.
- Two-column splits used the window breakpoint `lg` (1024 px), but the page has the window minus the 252 px sidebar: at 1024 px Panoramica, Investimenti and Debiti squeezed two columns into 724 px (the composition legend wrapped word by word, «Quanto rischia» was a strip).
- Pages used four different widths (`max-w-6xl`, `5xl`, `4xl`, `3xl`, centred), so the back button, the title and the blocks started at a different place on every section.

Decided: one `PAGE_FRAME` column for every page (narrow screens keep it and narrow their blocks, left-aligned); the shared 3/5 + 2/5 split and the other page-wide grids use container queries on `<main>` (`@container/main`, two columns from a 56rem content area); hero charts and banded lists bleed only on the phone. Living doc §4.1 of `docs/architecture/overview.md`.

Then Daniele pointed at the real issue: at first sight a page was a lot of information with no separation between its parts. Three ways to separate blocks were shown from the real app (Panoramica, Liquidità, Investimenti, Debiti; desktop, phone, dark): A every block in an island, opening included; B the opening (big figure and chart) stays on the page and every block under it is an island like the sidebar's; C no boxes, only more space. B was applied to every page (`data-page-block`, styles in `app/globals.css`), same 24 px between blocks everywhere.
