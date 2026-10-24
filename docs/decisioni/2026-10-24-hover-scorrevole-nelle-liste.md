# Sliding hover in the app's lists (2026-10-24)

After the desktop sidebar islands (#501), Daniele found the stretching hover pill turned into a large bubble when the pointer swept quickly across many items, and asked for the same hover on the other similar lists.

- `HoverHighlight` caps the stretch: the pill is never taller than 1.4 times the item it is reaching, so a fast sweep moves a pill of normal size instead of swelling over several rows. It also follows each item's left edge and width, and is drawn under the items' content (the list is its own stacking context), so rows need no extra positioning.
- Same hover, replacing the per-row `hover:bg-*`, in: the sidebar's summary modules (deadlines, portfolio and watchlist rows), the Impostazioni index on desktop, Investimenti positions and followed titles, the categories inside a spending group in Liquidità → Analisi, the language chooser and the instrument search results.
- Left as they are: lists of filled tiles separated by space (Liquidità accounts, subscriptions), where each tile already has its own background and a pill sliding behind them would not show; long transaction lists, whose rows have no row hover; shadcn dropdown menus (`components/ui`, highlighted by Base UI).
