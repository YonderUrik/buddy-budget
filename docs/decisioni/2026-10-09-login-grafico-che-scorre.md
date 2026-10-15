# 2026-10-09 — Login: the chart scrolls like a ribbon

- **Decision**: the net worth chart on the login no longer transforms all at once at every move: it has a fixed scale and a 24-period window that scrolls left, with a new point entering from the right and old ones leaving. No annotated points: only the line with the label on the last point.
- **Sample data**: the initial window is deterministic (same on server and browser, no hydration errors); new periods are a random walk that reverts towards the mean and stays within fixed limits (`login-horizon.model.ts`), so never off scale. The big number and the change follow the last period and can also go down. The line does not rise above the form on desktop.
- **Reduced motion**: it stays still on the initial window.
- **Postponed**: `login-mosaic.model.ts` remains only for its own tests; to be deleted if no longer needed.
