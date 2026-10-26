# «Dall'ultima visita» in one line (2026-10-26)

**Decision**: the «Dall'ultima visita» toast becomes one line («12 movimenti nuovi · 8 da sistemare») for 5 seconds; on the phone it comes from the top, below the notch, instead of covering the bottom bar and «Aggiungi»; on desktop it stays bottom right. It speaks only when something happened while the user was away: what waits alone (the same movements without a category) is no longer repeated at every visit. Option A, shown to Daniele on the real app next to option B (a label beside the Panoramica date, no toast).
**Why**: Daniele found the two-line toast too invasive, above all on the phone, and saw it again at every section change. Cause of the repeat: `WelcomeToast` sat inside the section transition (`key={section}`), which remounts the page at every section change, and the summary stayed in the query cache, so every remount showed it again. It is now mounted outside the shell and the summary is cleared from the cache once shown.
**Unchanged**: visits, the once-per-visit rule on the server, logs and Umami events. No migration.
Details: `docs/architecture/overview.md` §4.17.
