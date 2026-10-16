# 2026-10-08 — "Da sistemare" ("To fix") becomes a badge on Liquidità (Cash)

- The count (new or to-be-categorized transactions) is no longer a sub-item under Liquidità: it is a badge next to the item (dot on the icon with the compact sidebar). The component is `NavBadge` in `components/layout/sidebar.tsx`, passed from `AttentionShell` via `navBadges`: to move it, just change `ATTENTION_PARENT_HREF`.
- The card in Panoramica and the `/categorizza` page remain; clicking the badge goes to Liquidità. The Umami event `attention_link_clicked` remains only with `from: "home"` (there is no longer the click from the sidebar to Categorizza). The `transactions.attention` log is unchanged.
- The removal of Pianifica (Plan) landed on main with PR #193 (`2026-10-08-rimozione-pianifica.md`).
