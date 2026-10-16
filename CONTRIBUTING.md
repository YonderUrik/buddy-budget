# Contributing

Thanks for your interest. The project is developed by a single person: before writing code for a large change, open an issue to discuss it.

## Before you start

- By taking part you accept the [Code of Conduct](CODE_OF_CONDUCT.md).
- The architecture rules (component layers, observability, design tokens, background jobs) are in [`CLAUDE.md`](CLAUDE.md). They also apply to those who do not use an AI assistant.
- Code, comments, documentation, commit messages, pull requests and issues are in English. Only user-facing text (app UI, landing page, legal pages, emails to users) stays in Italian.

## Workflow

1. Fork the repository and create a dedicated branch.
2. Start the environment following the [README](README.md#local-development).
3. Before opening the PR: `pnpm lint`, `pnpm test`, `pnpm exec tsc --noEmit`.
4. A schema change requires `pnpm db:generate` and the committed migration. The database is never changed by hand.
5. Fill in the PR template: say what changes for people using the app and how you verified it.
6. The PR title follows Conventional Commits (`feat: …` new feature, `fix: …` fix, `chore:`/`docs:` with no effect on the version): release-please computes the version from it. See [docs/rilasci.md](docs/rilasci.md).

## Conventions in brief

- Colors, fonts and radii come only from the tokens in `app/globals.css`, never hardcoded values.
- Server code does not use `console.*`: log with `lib/observability`, without personal data (emails, IBANs, amounts, descriptions).
- Calculation logic lives in `lib/calc/` as pure functions, with tests.
- The interface must stay accessible (keyboard, labels, contrast, reduced motion): the checklist is in [`ACCESSIBILITY.md`](ACCESSIBILITY.md).
- A new feature is added to `lib/features/catalog.ts`.

## Contribution license

By contributing you agree that your contribution is released under the same license as the project (AGPL-3.0, see [`LICENSE`](LICENSE)).
