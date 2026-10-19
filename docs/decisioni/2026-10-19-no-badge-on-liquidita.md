# No count badge on Liquidità in the navigation

**2026-10-19.** Daniele asked to remove the number of transactions to categorise shown next to Liquidità (sidebar, phone bottom bar and «Altro» menu). The count stays inside the section, where it can be acted on: the sentence above the balance, the «Da decidere» filter in Movimenti, the «Da decidere» block in the side column and the Categorizza page. `AttentionShell` no longer passes `navBadges`; the generic `NavBadge` support in `components/layout` stays for future use, while the unused `formatBadgeCount` helper was removed.
