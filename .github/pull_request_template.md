## Before

<!-- What people using the app see or cannot do today. -->

## After

<!-- What changes for people using the app. -->

## How

<!-- In short: what the change does and how you verified it (tests, browser checks). -->

## Checks

- [ ] `pnpm lint`, `pnpm test` and `pnpm exec tsc --noEmit` pass
- [ ] If the database schema changes: migration generated and committed
- [ ] If a visible feature changes: `lib/features/catalog.ts` and landing updated (or "no impact on the landing")
- [ ] If the interface changes: keyboard, labels, contrast (light and dark) and `prefers-reduced-motion` checked, or "no impact on accessibility" (see [`ACCESSIBILITY.md`](../docs/accessibility.md))
- [ ] No personal data or secrets in code, tests or screenshots
- [ ] Observability: logs, Umami event, metrics, or "no new signal"
- [ ] The title is in Conventional Commits format (`feat: …`, `fix: …`, `chore: …`): the version is computed from it (see `docs/rilasci.md`)
