# Decisions: one file per PR

Date: 2026-10-04

Every PR added an entry at the top of `docs/decision-log.md`, so two PRs open at the same time always conflicted on the same line and required a "merge main into the branch" (and an extra CI run, ~3.4 minutes). From today each decision is a file in `docs/decisioni/` (`AAAA-MM-GG-titolo.md`); `docs/decision-log.md` remains the archive up to 2026-10-03 and the four entries of 2026-10-04 have been moved here. There is no generated index, so as not to reintroduce a shared file: the order is that of the names. Decision by Daniele ("si vai", 2026-10-04) on the proposal in the CI report.
