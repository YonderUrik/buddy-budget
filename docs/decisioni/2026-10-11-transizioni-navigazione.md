# Navigation transitions (2026-10-11)

Daniele's request: smoother section change in the desktop sidebar and in the bottom bar on mobile.

- **Sliding indicator**: the background of the active item is a single `motion.span` with `layoutId` (`SPRING_SNAPPY` spring) that moves from one item to another, as in the tabs (`SegmentedControl`). Each sidebar has its own `LayoutGroup`, so the desktop one and the mobile menu one do not compete for the pill.
- **Moves on tap**: `usePendingNavHref` moves the indicator as soon as the item is tapped, without waiting for the new page; it returns to the real path as soon as that changes.
- **Content**: `SectionTransition` in `AppShell` brings in the new section with a 200 ms fade and 4 px of slide. Only on entry (the old page disappears immediately), never on first opening nor between tabs of the same section; off with reduced motion.
- Rejected React's `<ViewTransition>`: it would animate the exit too and delay the appearance of the new page.
- Performance: `motion` was already in the common bundle (`MotionProvider` in the root layout), no extra JS.
