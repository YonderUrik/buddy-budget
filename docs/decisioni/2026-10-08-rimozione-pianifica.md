# Removal of the Pianifica (Plan) section

- Removed the placeholder item "Pianifica" from the navigation and the shared catalog: it no longer appears among the promised features on the login or the landing.
- The "In arrivo" ("Coming soon") panel hides when there are no future screens and does not start the timer with fewer than two items.
- There was no implemented route or domain to delete; the historical specs remain as reference, with no release commitment for Pianifica.
- Landing catalog synced; screenshots to regenerate: the local attempt with demo data stops at `/panoramica` (HTTP 500, Webpack does not resolve `perf_hooks` imported by `prom-client`).
