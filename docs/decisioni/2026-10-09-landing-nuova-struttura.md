# Landing: new structure and visibility in AI assistants

Date: 2026-10-09

From the competitor analysis (Claude Doc «Landing page: analisi competitor e piano SEO», thread of 2026-10-09: YNAB, Monarch, Copilot, Wealthfolio, getquin, Finary, Moneyfarm and others opened directly) the home page becomes: opening with verifiable facts and a real Panoramica that straightens as you scroll, three steps, the questions, «Le regole italiane, già nei conti» ("The Italian rules, already in the numbers": 6 rules with source and calculator), the four-groups method with a sample month, features, security, «Per chi è, e per chi no» ("Who it's for, and who it isn't"), comparison with a spreadsheet and spending-only apps (real HTML table), FAQ, closing. Copy in `landing/content/home.ts`; lucide icons as in the app.
For AI assistants: `/llms.txt` generated at every build from the same sources as the page (`content/llms.ts`) and AI crawlers allowed by name in `robots.txt`.
Choices: no reviews, user counts or savings promises until there are real data; the calculators section merges into the Italian rules.
Open (later phases, see the document): one page per question, `/sicurezza` page, comparisons, tax glossary, feature pages for Pensione and Debiti, public changelog; Lighthouse measurement.

Inner pages aligned with the home: a single menu (`SiteNav`) on all pages, «Tutte le funzioni» ("All features") by area with icon, app crop and cards (the whole catalog in the HTML, no longer one card at a time), tinted icons and tax notice at the bottom of content pages, screen gallery with the tabs above the image. Privacy, Terms, Cookies and 404 change only in the menu.
