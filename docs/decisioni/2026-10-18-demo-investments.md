# 2026-10-18 — A fuller portfolio in the demo account

The demo account (public demo and landing screenshots, `lib/public-demo/seed-investments.ts`) goes from 4 securities to 13 open positions plus 2 followed: ETFs (global, S&P 500, emerging markets at a small loss, a distributing dividend ETF, euro bonds), stocks in EUR, USD and CHF held at a second broker (Interactive Brokers for Italy, Trade Republic for Germany, with its own cash account), a government bond with its coupons, a 12-month bill already redeemed, gold, a crypto partly sold, a fund priced by hand, a stock deep at a loss, a benchmark, a target allocation, a watchlist with one waiting and one triggered price alert and, in Italy, a loss carried over from a previous broker.

Why: the demo is the first thing visitors of the launch see, and with four securities most investment screens (diversification, overlaps, currencies, brokers, income forecast, taxes) looked empty.

How: prices stay invented (the price cron skips demo instruments); equities share a market move so correlation and benchmark figures look plausible, and the last three months rise by about 4%. On a database without exchange rates the seed writes invented USD/CHF rates; real ones are never touched. The older demo figures that do not depend on investments (transactions, goals, pension) stay the same.
