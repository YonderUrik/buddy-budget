# 2026-10-10 — SEO audit: technical fixes to the landing

From the buddybudget.io audit of 10 October (only the items with failed checks):
- **4xx (1) and broken internal links (2)**: the address `privacy@buddybudget.io` in the Privacy and Terms text was replaced by Cloudflare with `/cdn-cgi/l/email-protection`, which for a crawler without JavaScript is a 404. It is now a `mailto:` link wrapped in `<!--email_off-->` (`components/legal-page.tsx`).
- **Structured data (13)**: `SoftwareApplication` (layout, on every page) and `WebApplication` (two calculators) require `aggregateRating` or `review`, which we do not have and do not invent: removed. `Organization` and `WebSite` remain everywhere, `FAQPage` only on the home (where the questions are visible), `WebPage` on the calculators.
- **h1 equal to the title (1)**: the guide on the zainetto fiscale (tax-loss carryforward) has its own title.
- **HSTS (2)**: header in `landing/nginx.conf` and `_headers` (apex); Traefik `hsts` middleware in the infra repo for the `www` redirect.
- **Postponed / not solvable here**: robots.txt «formato non valido» ("invalid format": the `Content-Signal` line is in the contentsignals.org specification and ignored by RFC 9309-compliant parsers: kept), «poco testo rispetto all'HTML» ("little text relative to HTML": Next's RSC payload weighs ~22 KB per page) and «poche parole» ("few words": `/schermate`, `/funzioni/investimenti`): they need copy, part of the work on the landing copy.
