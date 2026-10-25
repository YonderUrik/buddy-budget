# README and documentation trimmed before the launch (2026-10-25)

Before Show HN, Daniele asked for a README that is simple and correct and for documentation without useless parts.

- The README now says what the app does in one short list with English names, how to run it, its status and the license. The long self-hosting paragraph moved to `docs/self-hosting.md`, which already had it.
- Facts fixed where they had drifted from the code: new bank connections are paused on the hosted version, categories apply on their own from 70% confidence (not 90%), Analitiche runs in Germany and in `OTHER`, the monthly budget, «Aggiungi» and «Cerca» answers are done.
- Removed files that were evidence for single pull requests, not documentation: `docs/pr-screenshots/`, `docs/testing/`, `docs/screenshots/`, `docs/deployment/` (the CSV worker runs from the compose and the infra repo), `docs/seo-piano.md` (a dated marketing plan), and the "local verification" notes inside the DEGIRO and Trade Republic guides. Git history keeps them.
- The README video is hosted as a GitHub attachment (`user-attachments`), not in the repository, so the clone does not grow.
