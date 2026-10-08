# 2026-10-08 — "Da sistemare" diventa un badge su Liquidità

- Il conteggio (transazioni nuove o da categorizzare) non è più una sottovoce sotto Liquidità: è un badge accanto alla voce (pallino sull'icona con la sidebar compatta). Il componente è `NavBadge` in `components/layout/sidebar.tsx`, passato da `AttentionShell` via `navBadges`: per spostarlo basta cambiare `ATTENTION_PARENT_HREF`.
- La card in Panoramica e la pagina `/categorizza` restano; il clic sul badge porta a Liquidità. L'evento Umami `attention_link_clicked` resta solo con `from: "home"` (non c'è più il clic dalla sidebar verso Categorizza). Il log `transactions.attention` è invariato.
- La rimozione di Pianifica è arrivata su main con la PR #193 (`2026-10-08-rimozione-pianifica.md`).
