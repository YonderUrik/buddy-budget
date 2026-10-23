# SEO and indexing: audit, keywords, plan (2026-10-02)

Market: Italy, Italian. Domain to rank: `buddybudget.io` (landing). `app.buddybudget.io` stays out of the index (`robots.txt` with `Disallow: /` except `/login`, which carries `noindex`; until 2026-10-23 the app's `robots.txt` redirected to the sign-in page, so Google crawled the app).

## 1. Technical audit of the landing

| Item | Before | After (PR) |
|---|---|---|
| Title | "BuddyBudget: quanto vali, davvero?" ("how much are you really worth?"; no searched word) | "BuddyBudget: app per budget, investimenti, pensione e debiti" ("app for budget, investments, pension and debts") |
| Meta description | generic | with features and "tasse italiane già calcolate" ("Italian taxes already calculated") |
| Canonical | missing | `/`, `/privacy`, `/termini`, `/cookie` |
| Open Graph / Twitter | no image, `summary` card | `og.png` 1200×630, `summary_large_image` card |
| Structured data | none | JSON-LD: Organization, WebSite, SoftwareApplication (FinanceApplication, price 0), FAQPage |
| Text with keywords | brand-only H1 ("Quanto vali, davvero?"), generic hero paragraph | hero paragraph with "app per gestire budget, investimenti, fondo pensione e debiti" ("app to manage budget, investments, pension fund and debts") + FAQ section (8 questions) |
| Sitemap / robots | present, without `lastmod` | `lastmod` added, then removed on 2026-10-23 (it was the build date on every page, which Google learns to ignore) |
| Rendering | static export: all text is already in the HTML | unchanged (ok) |
| Image alt | screenshots with descriptive alt, decorative ones with `alt=""` | unchanged (ok) |
| hreflang | not needed (Italian only) | to be added when i18n arrives |

Still to do (not in this PR):
- **A single indexable page**: this is the main limit. A single landing page competes only on the brand keyword and a few generic ones. Dedicated pages are needed (section 3).
- **H1**: it is a brand claim. It can stay, but every new page must have an H1 with the keyword.
- **Core Web Vitals**: not measurable from here (the sandbox cannot reach the site). To check with PageSpeed Insights / Search Console; suspects: GSAP + Lenis (initial JS), 2 variable fonts, hero with 1920×1200 JPEG screenshots (consider `srcset`/smaller sizes, `fetchpriority=high` only on the first).
- **Legal pages**: since 2026-10-10 final, indexable and in the sitemap (still to be reviewed by a professional).

## 2. Keywords by intent

Note: I have no access to real search volumes (they require Search Console after a few weeks, or the free Google Keyword Planner with an Ads account). The map below is by intent, based on the results that currently occupy the first page: "best apps" lists from publications (money.it, investireoggi, ilgiornale), calculators from small sites (sum.money, rivaluta.it, tuttocalcolato.it) and tax guides (fiscoinvestimenti.it, fiscomania, money.it for "zainetto fiscale", the tax-loss carryforward).

The example searches are kept in Italian, since they are the actual Italian queries.

| Intent | Example searches | Estimated difficulty | How to rank |
|---|---|---|---|
| Brand | "buddybudget", "buddy budget app" | low | home (already) |
| Category (high competition) | "app gestione budget", "app per tenere traccia delle spese", "migliori app finanza personale" | high | not head-on: get in through other people's lists (section 4) |
| Investment taxation (informational, long tail) | "zainetto fiscale", "come si calcolano le plusvalenze ETF", "bollo titoli calcolo", "minusvalenze 4 anni" | medium | guides + free calculator; this is your unique advantage |
| Pension | "TFR o fondo pensione conviene", "simulatore fondo pensione", "quanto rende il mio fondo pensione", "prelievo fondo pensione tassazione" | medium | guide + simulator/feature page |
| Debts | "piano di ammortamento calcolo", "estinzione anticipata mutuo conviene", "surroga mutuo calcolo", "TAEG calcolo", "credit lombard" | medium-high | guides + calculators |
| Bank data | "collegare conto bancario app spese", "open banking cos'è" | medium | feature page + guide |
| Comparison | "alternative a ..." (known apps), "foglio excel budget vs app" | low-medium | comparison pages, honest and without naming brands improperly |

Glossary for the terms above: plusvalenze/minusvalenze (capital gains/losses; Italian losses can be offset for 4 years), bollo titoli (stamp duty on securities), TFR (Italian severance pay, which can go to a pension fund), surroga (mortgage portability to another bank), TAEG (APR), estinzione anticipata (early repayment).

Realistic positioning: the generic category will not be won soon. It is won on the long tails tied to taxes, pension and debts, where no competitor combines budget + investments + Italian taxes + debts + pension.

## 3. Map of pages to create (in priority order)

1. **Free public calculators** (the strongest for traffic and backlinks, no login): zainetto fiscale / tax on capital gains; TFR vs pension fund; amortization schedule + early repayment. They reuse the engines in `lib/calc/` (already tested). Each with an H1 matching the search, explanation, FAQ and CTA to the app.
2. **Guides** (`/guide/...`, 800-1500 words, written by a person and reviewed for tax accuracy): zainetto fiscale explained; how ETFs and BTPs (Italian government bonds) are taxed; TFR or pension fund; early repayment and surroga; the 50/30/20 budget and the four groups (Dovute, Volute, Te futuro, Saltuarie — "Must", "Want", "Future you", "Occasional").
3. **Feature pages** (`/funzioni/investimenti`, `/pensione`, `/debiti`, `/budget`): one per area, with screenshots and FAQ.
4. **Comparisons**: "BuddyBudget vs spreadsheet", "budget app vs investment app".
5. **Blog/news** only if there is consistency: better 8 good pages than 40 thin ones.

Rules: every page with its own title/description, canonical, suitable JSON-LD (`Article`, `BreadcrumbList`, `WebApplication` for the calculators), internal links from the home and between pages, in the sitemap. Tax content: "estimates, not advice" notice and professional validation before publishing (the pension rules are still assumptions).

## 4. What is needed from you (not code)

1. **Google Search Console**: add the "Domain" property `buddybudget.io` and verify it with the DNS TXT record (Cloudflare → DNS). Then Sitemaps → submit `https://buddybudget.io/sitemap.xml`. Use "URL Inspection" → "Request indexing" for the home. Keep an eye on Performance (queries and pages) after 2-4 weeks.
2. **Bing Webmaster Tools**: you can import the property directly from Search Console. It also counts for DuckDuckGo and for AI assistants that use Bing.
3. **Before launch**: the apex `buddybudget.io` must actually serve the landing (apex switch still to be done, see project status) and `www` must redirect with a 301 to the apex. Move the legal pages from draft to final if you want them indexed.
4. **Google Business Profile**: not needed (you have no local business).
5. **Backlinks and visibility** (the factor that weighs most today for a new domain):
   - Product Hunt (launch in English, for a first wave and an authority link).
   - Italian communities: r/ItalyInvesting, r/finanza, r/personalfinanceitaly, Bogleheads Italia / Finanza forum, Telegram and Facebook groups of ETF investors. Rule: participate and help, do not spam; share the free calculators, which are useful even without the app. Always disclose that you are the author.
   - Dev/indie: Indie Hackers, Hacker News "Show HN" (with technical detail: Open Banking, Italian taxes), posts on dev.to/Medium in Italian on "how I built" the tax engine.
   - Contact the publications with "best personal finance apps" lists (money.it, investireoggi...) with a short email and a demo: you want to be in the list when they update it.
   - Software directories (AlternativeTo, Capterra/G2 only once there is a user base).
6. **Measurement**: Umami on the landing already tracks visits; add the service user in Search Console only if you want to automate reports (optional).

## 4-bis. AI assistants (ChatGPT, Claude, Perplexity, Gemini) — 2026-10-09

- `/llms.txt` (llmstxt.org format) generated on every build from the FAQ, Italian rules, groups method and feature catalog (`landing/content/llms.ts`): it cannot diverge from the site.
- `robots.txt` allows AI crawlers by name (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended…).
- Citable content: short sentences with the fact and the official source (section «Le regole italiane», "The Italian rules"), a real HTML table for the comparison, FAQ in plain text.
- To do: check citations every month (ask the assistants «app per tenere conti e tasse sugli ETF in Italia», "app to track accounts and ETF taxes in Italy"), Bing Webmaster Tools (used by several assistants), one page per question.
- Note: according to industry sources, Google's FAQ rich results no longer appear since May 2026; the FAQPage markup stays, harmless.

## 5. What NOT to do
- No mass-generated text or duplicate pages per city/keyword: Google penalizes thin content.
- No exchanging or buying backlinks.
- Do not index `app.buddybudget.io`.

## 6. Realistic timelines
Indexing of the home: days to weeks after submission in Search Console. Stable positions for long tails: 2-4 months with useful content and a few backlinks. Generic traffic on the category: beyond 6-12 months.
