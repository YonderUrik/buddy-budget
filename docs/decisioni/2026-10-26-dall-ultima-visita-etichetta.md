# «Dall'ultima visita» as a label in Panoramica (2026-10-26)

**Decision**: the «Dall'ultima visita» toast is gone. A label beside the Panoramica date, in the place of «Novità», says the first thing that happened while the user was away («● 12 movimenti nuovi e altro»), and a tap opens the summary with one button per line. It appears only when something happened while away: what waits alone (the same movements without a category) is no longer repeated at every visit. Option B, chosen by Daniele over A (the toast reduced to one line, from the top on the phone), both shown on the real app.
**Why**: Daniele found the toast too invasive, above all on the phone where it covered the bottom bar and «Aggiungi», and saw it again at every section change. Cause of the repeat: the toast lived inside the section transition (`key={section}`), which remounts the page at every section change, and read the cached summary again. The visit heartbeat now sits outside the shell.
**Trade-off**: the user sees it only on Panoramica (where the app opens by default).
**Unchanged**: visits, the once-per-visit rule on the server, logs. New Umami event `welcome_summary_opened`. No migration.
Details: `docs/architecture/overview.md` §4.17.
