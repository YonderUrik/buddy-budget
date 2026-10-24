# 2026-10-24: landing SEO fixes from the heycatch audit

The heycatch SEO audit (83/100) left seven open findings on buddybudget.io. This PR fixes them in `landing/`:

- **Titles and descriptions**: every page now has a 30-60 character title and a 110-160 character description; `pageMetadata` throws at build time outside those lengths, so a new page cannot regress silently.
- **Sitemap `lastmod`**: back, but honest: `scripts/page-dates.mjs` dates each page by the last commit that touched its own files (page plus imports used by at most half of the pages), so a footer change does not refresh every date. It needs full git history (the `landing-image` job checks out with `fetch-depth: 0`); without it the field is left out, never the build date. A daily `IndexNow` workflow sends the pages changed in the last 3 days (public key file in `landing/public/`).
- **Structured data**: one `pageJsonLd` helper gives every page a `WebPage`/`Article` node (headline = title, image, `dateModified`), including the homes and legal pages; Organization gets `sameAs`, the GitHub repository and the Instagram profile (Buy Me a Coffee stays off the landing, 2026-10-17). More profiles go in `SAME_AS` when they exist.
- **Thin guide**: the zainetto fiscale guide (it/en) explains which instruments feed the zainetto (ETF gains do not use it, BTP at 48.08%, crypto apart), two worked cases, order of offsets in amministrato vs dichiarativo, changing broker (D.Lgs. 461/1997 art. 6) and the end-of-year check. The rules match `docs/architecture/taxes.md`.
- **Visuals**: an SVG diagram of the bank data path on the security pages and a yearly principal/interest chart in the amortization calculator, both with a text equivalent.

Not done: visuals on the legal pages (nothing substantive to show), more `sameAs` profiles (Daniele to provide).
