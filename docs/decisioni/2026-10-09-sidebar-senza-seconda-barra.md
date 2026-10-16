# Sidebar without a second scrollbar

Date: 2026-10-09

On short windows (below ~780 px in height) the summary below the menu items exceeds the space and the sidebar nav scrolled on its own, showing on mouse hover a scrollbar next to the page's: in Liquidità · Movimenti, which is long, two scrollbars were visible side by side.
The nav stays scrollable (wheel, touch, keyboard) but no longer draws the bar (`.sidebar-nav` in `app/globals.css`). So only one visible scrollbar remains, the page's.
Open: if the summary grows further, consider hiding the less important rows on short windows instead of making them scroll.
