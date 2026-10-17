# Living architecture docs, documentation index and roadmap (2026-10-17)

Inspired by how Wealthfolio documents its code on GitHub, the repo now has three things it lacked:

- `docs/architecture/`: one living page per area (overview, background jobs, bank sync and imports, categorisation, investments, market data, taxes, pension, debts, net worth, analytics and goals), written from the code with principles, data model, each calculation with a worked example, limits and tests. It changes in the same PR as the behaviour it describes; `docs/superpowers/` specs and plans stay as history.
- `docs/README.md`: the index of all documentation, grouped by audience (use and host, understand, contribute, history).
- `ROADMAP.md`: vision, strategy and phases with what is done and what is deferred. `docs/product-vision.md` was rewritten (it still described the mockup phase).

Rule added to `CLAUDE.md` and `CONTRIBUTING.md`. Deferred: a public user guide on the landing (`/guida`) with a glossary, and renaming Italian file names in `docs/`.
