# README, documentation and repository weight before the launch (2026-10-25)

Before Show HN, Daniele asked for a README that is simple and correct and for documentation without useless parts.

- The README now says what the app does in one short list with English names, how to run it, its status and the license. The long self-hosting paragraph moved to `docs/self-hosting.md`, which already had it.
- Facts fixed where they had drifted from the code: new bank connections are paused on the hosted version, categories apply on their own from 70% confidence (not 90%), Analitiche runs in Germany and in `OTHER`, the monthly budget, «Aggiungi» and «Cerca» answers are done.
- Removed files that were evidence for single pull requests, not documentation: `docs/pr-screenshots/`, `docs/testing/`, `docs/screenshots/`, `docs/deployment/` (the CSV worker runs from the compose and the infra repo), `docs/seo-piano.md` (a dated marketing plan), and the "local verification" notes inside the DEGIRO and Trade Republic guides. Git history keeps them.
- The README video is hosted as a GitHub attachment (`user-attachments`), not in the repository, so the clone does not grow.
- Repository weight on 2026-10-25: a full `git clone` was 625 MB because the branch `codex/staging-environment` (closed PR #509, staging already on `main`) had been pushed from a clone made before the 2026-10-21 history rewrite and carried the old 559 MB history; `main` alone was 87 MB, 68 MB of it WebP screenshots committed between #467 and #474. The branch and the other branches of merged or closed PRs are deleted, and a second rewrite drops those WebP files from the history (target: clone under 30 MB).
- New CI check `Repo weight` (`scripts/check-file-sizes.mjs`) so it does not happen again: no image, video or archive over 300 KB, no more than 1 MB of them in one PR, no images under `docs/`, no file over 5 MB; exceptions in `.github/large-files-allow.txt`.
