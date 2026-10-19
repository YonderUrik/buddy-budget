# «Primi passi» react to imports and other updates (2026-10-19)

**Decision**: the «Importa i movimenti» step is done as soon as the user has any real (non-sample) transaction: bank sync, CSV import or typed by hand. Before, only bank-synced transactions (`source = 'auto'`) counted, so a CSV import never ticked the step and it kept asking for something already done.
**Also**: while a step is missing and the tab is visible, the steps are re-read every 15 seconds (`useStartQuery`), on top of the refresh after any write, finished import or sync and when the user comes back to the page. Imports finishing on another device or from a cron show up without a reload. The done line reads «Movimenti aggiunti».
**Why**: Daniele noticed the section did not mark what had been done after an import. **Deferred**: a push from the server (SSE) instead of polling; not worth it for one cheap query.
