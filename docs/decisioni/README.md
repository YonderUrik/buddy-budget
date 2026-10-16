# Project decisions

One decision per file, one file per PR: `AAAA-MM-GG-titolo-breve.md` (date of the decision, lowercase title with hyphens).
This way two PRs open at the same time do not touch the same file and no longer conflict on the log (previously every PR added an entry at the top of `docs/decision-log.md`).

Format: title `# …`, line `Data: AAAA-MM-GG` (Date), then 3-8 lines: what was decided, why, what remains open. The details of a piece of work go in its spec/plan in `docs/superpowers/`.

Decisions up to 2026-10-03 are in the archive [`docs/decision-log.md`](../decision-log.md). To read them in order: `ls docs/decisioni`.
