# French interface language (2026-11-13)

French (`fr`, `fr-FR` formats) is a fourth interface language, contributed in PR #564 by an external contributor (catalog `lib/localization/catalogs/fr.json`, same keys and placeholders as the English one, checked by `config.test.ts` and `completeness.test.ts`).

- Only with the `OTHER` product country: the Italy and Germany products stay in their two languages each. Picking French before onboarding proposes `OTHER`.
- Visitors from France and Monaco start in French (`CF-IPCountry`); Luxembourg (French, else German), Belgium (English, French with a French browser, since Dutch is not available) and Switzerland (German, Italian or French) follow the browser. Without a country header (self-hosted), a French browser starts in French.
- French has no public demo: `pickPublicDemoProfile` falls back to the country's default demo (`OTHER`/`en`) instead of a demo account that does not exist (before this fix `/demo?lang=fr` ended on the sign-in page).
- Not in French yet: the landing (Italian and English), the public demo (IT it/en, DE en/de), the sentence rules of «Cerca» (Italian, English, German; French needs «Chiedi all'AI»), legal texts.
- Security review after the merge: no dependency, CI, network or authorization change; catalog values contain no markup or links.
