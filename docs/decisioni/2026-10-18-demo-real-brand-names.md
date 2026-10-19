# 2026-10-18 — Real brand names in the demo account

The demo account (public demo, landing screenshots and social posts, `lib/public-demo/`) now uses names people know, so the screens show familiar logos instead of grey initials.

- Transactions: Esselunga and Conad, Eni, Enel Energia, TIM, Netflix, Spotify, Amazon, Zara, Booking.com, iCloud+ and UnipolSai; in German Lidl, Aldi, Stadtwerke, Vodafone and Allianz where an Italian brand would be odd. Local shops (bar, trattoria, gym, pharmacy, hardware store) keep invented names and no logo.
- Securities: Vanguard FTSE All-World, iShares Core S&P 500, Xtrackers MSCI Emerging Markets, iShares Core MSCI World, iShares Physical Gold, Ferrari, SAP, Apple, Nike, Nestlé, NVIDIA (followed) and Bitcoin. Bonds, bill and the hand-priced fund stay generic.
- ETCs now get the issuer's mark like ETFs (an iShares gold ETC shows iShares, not «Ip»), for every user.

Why: Daniele found the screens anonymous; the posts and the launch need screens that look like a real person's money.

How: only names change. ISINs stay invented (`…DEMO…`), so the price cron, dividend fetches and quotation links never touch the demo, and stock logos come from the local brand glyphs. Prices are still invented, chosen by Daniele over real prices: each series starts and ends near the real close of mid-August 2025 and 16 October 2026 (`REAL_CLOSES` in `seed-investments.ts`), and the demo drifts from the market over time; refresh those numbers when the gap shows. Amounts and dates of transactions stay invented, and the demo keeps saying it is sample data.
