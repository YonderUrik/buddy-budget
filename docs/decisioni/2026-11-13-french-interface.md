# French interface language (2026-11-13)

French (`fr`, `fr-FR` formats) is a fourth interface language, contributed in PR #564 by an external contributor (catalog `lib/localization/catalogs/fr.json`, same keys and placeholders as the English one, checked by `config.test.ts` and `completeness.test.ts`).

- Only with the `OTHER` product country: the Italy and Germany products stay in their two languages each. Picking French before onboarding proposes `OTHER`.
- On the hosted service a visitor from France still lands in English (`CF-IPCountry` maps it to English, as every country without local rules) and picks French by hand; where there is no country header (self-hosted), a French browser starts in French.
- Not in French yet: the landing (Italian and English), the public demo (IT it/en, DE en/de), the sentence rules of «Cerca» (Italian, English, German; French needs «Chiedi all'AI»), legal texts.
- Security review after the merge: no dependency, CI, network or authorization change; catalog values contain no markup or links.
