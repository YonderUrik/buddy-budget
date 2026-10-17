# Product Marketing Context

**Document version:** v1
**Last updated:** 2026-10-17

Shared context read by the marketing skills in `.claude/skills/` (copywriting, cro, social, ads, ad-creative, seo-audit…). Facts here must stay verifiable in the product; when the product changes, update this file in the same PR. User-facing copy is Italian (also English and German); this file is in English like the rest of the repo.

## Product Overview
**One-liner:** All your money in one number: bank accounts, investments, pension fund and mortgage together, updated every day, taxes included. (Landing: «Tutti i tuoi soldi, in un numero solo.»)
**What it does:** BuddyBudget brings together the tools people use to track money (an expense app, an investment spreadsheet, another one for the mortgage) and links them to net worth day by day. It applies the Italian rules where they matter: plusvalenze and minusvalenze (capital gains and losses), zainetto fiscale (tax-loss carryforward), 12.5% on government bonds, bollo (stamp duty), pension fund taxation.
**Product category:** Personal finance app / net worth tracker / budgeting app ("app per gestire le spese", "patrimonio netto", "portafoglio investimenti").
**Product type:** Web app (installable PWA; native iOS/Android shell in progress), open source (AGPL-3.0), self-hostable with Docker.
**Business model:** Free during the beta. A paid plan is likely later, so ads and videos never say «gratis», «beta» or a price. Donations only on GitHub (Buy Me a Coffee), never inside the app.

## Target Audience
**Who:** Adults in Italy (and Germany, with a reduced feature set) who already keep track of their money, often in a spreadsheet, and have at least two of: current accounts, a broker (IBKR, DEGIRO, Trade Republic, Fineco), a pension fund, a mortgage or loan.
**Primary use case:** Knowing how much you really have, all included, and what changes with a choice (pay the mortgage early, sell an ETF, save more).
**Jobs to be done:**
- "Tell me my real net worth without updating a spreadsheet every month."
- "Tell me how much tax I'd pay if I sold, and what my zainetto is worth."
- "Tell me when I could stop working, and what moves that date."
**Use cases:**
- Bank transactions arrive categorised; budget per spending group (Dovute, Volute, Te futuro, Saltuarie).
- Import broker statements, see TWR/XIRR, dividends, Italian tax estimate.
- Mortgage schedule, early repayment and surroga simulations.
- Pension fund vs TFR (Italian severance pay) comparison.
- FIRE year with «e se…» sliders; savings goals; subscriptions detected from transactions.

## Personas
B2C, so these are the editorial plan's personas (2026-10-16), not buying roles.
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Marta, conti sparsi | Seeing everything in one place | Three banks, a card, a spreadsheet she stopped updating | One number, updated by itself |
| Luca, investe da solo | Taxes and real returns | Broker apps show gross figures; Italian taxes computed by hand | Net return and tax estimate with the Italian rules |
| Sara, vuole una data | When she can stop working | Doesn't know if her savings rate is enough | A year, and what moves it |

## Problems & Pain Points
**Core problem:** Money is spread across bank, broker, pension fund and loans; no single tool adds them up or knows Italian taxation.
**Why alternatives fall short:**
- Expense apps stop at the current account.
- Broker apps ignore other accounts and Italian tax details (zainetto, bollo).
- Spreadsheets are accurate only until you stop updating them.
- Foreign trackers (YNAB, Finary, Wealthfolio, Actual) don't apply Italian tax rules.
**What it costs them:** Hours of monthly bookkeeping; wrong decisions on selling, the mortgage or the pension fund.
**Emotional tension:** "I don't really know how I'm doing." Doubt about trusting an app with bank data.

## Competitive Landscape
**Direct:** Finary, Wealthfolio, YNAB, Money Manager — no Italian taxation, or budget-only, or investments-only.
**Secondary:** Broker and bank apps — each sees only its own money.
**Indirect:** Excel/Google Sheets — flexible but manual and silently out of date.
Market note: no rival combines budget + investments + Italian tax + debts (competitor analysis 2026-10-13 and 2026-10-17, `/mnt/project-files/analisi-competitor/`).

## Differentiation
**Key differentiators:**
- Net worth across bank, investments, pension fund and debts in one number, history included.
- Italian tax rules inside the calculations (plusvalenze, zainetto, 12.5% on BTPs, bollo, pension fund, TFR).
- Read-only bank access (PSD2 via GoCardless); the app can't move money.
- Open source AGPL-3.0, self-hostable, servers in Germany, full ZIP export and deletion.
- Calculations you can check: pure tested functions, estimates show what they start from.
**Why customers choose us:** It replaces the spreadsheet and answers questions in their own terms (taxes, mortgage, "when can I stop").

## Objections
| Objection | Response |
|-----------|----------|
| "I don't give my bank password to an app." | You never do: you sign in on the bank's own site (PSD2), access is read-only and lasts 90 days. Or import a file. `/sicurezza` explains the data path. |
| "Who is behind it? Will it disappear?" | One named person building in public; code on GitHub; export everything any time; self-host it. |
| "Are the tax figures right?" | They're estimates with the rule and the source shown; not tax advice. Pension rules not yet validated by a professional. |
| "My bank isn't supported." | CSV import and manual accounts. Bank connections are limited (1 bank per person, 40 in total on the current GoCardless plan). |
**Anti-persona:** People who want investment advice or trading; businesses/freelancers needing accounting or invoicing; people outside IT/DE needing local tax rules.

## Switching Dynamics
**Push:** The spreadsheet is out of date again; broker apps show gross returns.
**Pull:** One number; taxes computed; "the year you could stop working".
**Habit:** Years of spreadsheet formulas; "my bank app is enough".
**Anxiety:** Bank data security; time to set up; whether the numbers are right.

## Customer Language
**How they describe the problem:**
- "Ho i soldi sparsi in tre banche e un broker."
- "Il foglio Excel non lo aggiorno più."
- "Quanto pago di tasse se vendo?"
**Words to use:** soldi, conto, mutuo, tasse, quanto hai, in tutto, patrimonio netto (explained), sola lettura, dati d'esempio.
**Words to avoid:** «gratis», «beta» and prices in ads/videos; "rivoluzionario", "smart", "potenzia", "AI-powered"; anything that reads as investment advice or a product recommendation (CONSOB risk).
**Glossary:**
| Term | Meaning |
|------|---------|
| Panoramica | Overview screen with net worth |
| Liquidità | Cash: accounts and transactions |
| Zainetto fiscale | Capital losses that can offset future gains (4 years) |
| Regime amministrato | Broker withholds taxes for you |
| TFR | Italian severance pay, can go to a pension fund |
| Dovute / Volute / Te futuro / Saltuarie | Spending groups: needs / wants / future you / occasional |

## Brand Voice
| Attribute | Means | Doesn't mean | Example line |
|-----------|-------|--------------|--------------|
| Plain | Everyday words first, technical fact right after | Dumbing down | «Si collega e legge. Non può muovere soldi.» |
| Factual | Every claim checkable in the product | Hype, slogans | «Due numeri dal rendiconto. Quando vuoi.» |
| Calm | Short sentences, no urgency | Cold | «Importo, tasso e durata. Una volta sola.» |
| Honest about limits | Limits stated next to features | Apologetic | «Banca in sola lettura · Server in Germania» |

**Tone by context:**
- Support: direct, first person, names what happens next.
- Launch: what's new in plain words, one limit stated.
- Errors: what happened, what to do, «Segnala questo problema».
- Social: a question people actually ask, answered with a real screen and a figure.
**Never use (and why):** gradients/glow/"AI slop" visuals and slogans (owner rejects them); filler lines like «ogni mattina», «Gratis durante la beta», trust-badge lists (removed everywhere, 2026-10-17); highlight boxes in videos; bank/broker logos in ads (trademark risk).

**Visual identity:** navy + brand yellow (yellow only for the main action), tall condensed titles (Sofia Sans Extra Condensed), Hanken Grotesk text, Space Grotesk figures; real app screenshots with sample data, labelled «dati d'esempio». Videos animate the data full screen; the real screen appears only zoomed on the point.

## Proof Points
**Metrics:** none public yet (beta). Don't invent user counts or testimonials.
**Verifiable facts:** open source on GitHub (AGPL-3.0); PSD2 read-only; servers in Germany; banks in the countries listed in `landing/content/sheet.ts`; imports from IBKR, DEGIRO, Trade Republic, Fineco, Yahoo Finance, CSV; it/en/de.
**Value themes:**
| Theme | Proof |
|-------|-------|
| One number | Panoramica net worth by asset class |
| Italian taxes | Tasse tab, `lib/calc/` tested functions |
| Trust | `/sicurezza`, field encryption, export/deletion, source code |

## Goals
**Business goal:** Grow active users during the beta ahead of a paid plan; launch on Show HN (2026-11-10) and Product Hunt (2026-11-17).
**Conversion action:** Account created, then first data in (bank connected, file imported or manual account), measured with Umami events and `utm_*` on links.
**Current metrics:** MISSING.

## Paid Ads (optional)
**Target CPA / ROAS:** MISSING (no revenue yet; decide a max cost per account created).
**Monthly budget and daily variance:** MISSING.
**Conversions that count:** account created (Umami); landing visits by `utm_content`.
**Known tracking weaknesses:** no Meta Pixel / Conversions API; Umami is cookieless, so ad attribution relies on UTM only.
**Constraint:** bank connections are capped (40 in total), so ads must not promise bank sync to large audiences.
**Agent may:** draft, compare, recommend. **May not (without approval):** spend money, launch or pause campaigns, publish posts.

## Learnings
*Decisions and tested lessons. Newest first.*
| Date | Learning | Evidence | Applies to | Status |
|------|----------|----------|------------|--------|
| 2026-10-16 | Reels with a small phone scrolling screenshots and the same music were rejected; animate the data full screen, show the real screen zoomed on the point, vary music | Owner review of the first 6 reels | video, social, ad-creative | active |
| 2026-10-16 | No highlight boxes in videos; use a camera zoom toward the point | Owner review | video | active |
| 2026-10-12 | No «gratis»/«beta»/price in ads and videos | Owner decision: app likely paid when advertised | ads, ad-creative, social | active |
| 2026-10-17 | Remove filler lines; keep technical spec lines and captions | Owner decision on landing | copywriting, copy-editing | active |

## Changelog
*Newest first.*
- v1 (2026-10-17) — Initial context drafted from the README, landing copy, editorial plan and project decisions.
