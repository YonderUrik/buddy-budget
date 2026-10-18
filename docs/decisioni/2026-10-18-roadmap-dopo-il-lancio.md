# Roadmap and public pages before the launch

Date: 2026-10-18

Prepared for the Show HN launch after reading 22 Hacker News threads about finance apps (trust, AI and bank sync came up most):

- `ROADMAP.md` says what comes next: the native iOS and Android apps first, then more countries added one at a time, shared accounts for couples and families (no longer deferred), and a small subscription for the hosted version, while self-hosting stays free under AGPL-3.0. Prices and timing are not decided.
- README, roadmap and the docs index were trimmed to what a reader needs.
- README and the self-hosting guide say that GoCardless no longer accepts new sign-ups (July 2025), so a new self-hosted install imports CSVs.
- The security page has a question on AI: the three places it is used, what is sent (merchant name and direction for categories, the whole file for an import), OpenRouter with zero retention requested on every request, and the limit that this is not a signed contract.
- The Privacy policy, Terms and Cookie page are translated in full at `/en/privacy`, `/en/terms` and `/en/cookies`, paired with the Italian pages for hreflang and the language menu. Each says the Italian text prevails; a test checks both languages have the same sections.
- The three calculators and the zainetto fiscale guide have English pages under `/en/calculators` and `/en/guides`, still applying Italian tax law. The Italian amortization calculator rounded cents wrongly ("235,100 €" instead of "236,00 €"); fixed.
