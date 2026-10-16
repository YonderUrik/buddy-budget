# English as the repository language (2026-10-15)

Daniele decided that English is the main language of the codebase. All documentation was translated (README, SECURITY, CONTRIBUTING, CLAUDE.md, `docs/` including decisions, specs, plans and the self-hosting guide), together with the PR and issue templates and the comments in CI, Docker and env example files; the infra repo got the same treatment in its own PR.
From now on code comments, JSDoc, commit messages, PR titles and descriptions, issues and new documentation are written in English. User-facing text stays in Italian: app and landing UI, translation catalogs, legal pages, emails to users.
File and folder names were kept (`docs/decisioni/`, `docs/rilasci.md`, ...) so that links, the landing and parallel PRs do not break. Italian tax terms keep their original name with a short English explanation.
Deferred: translating the comments already in the source code (they move to English when a file is touched), renaming the Italian folders and file names, rewriting the existing CHANGELOG.
