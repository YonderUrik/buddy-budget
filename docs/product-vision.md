# Product vision

## What it is

BuddyBudget is a personal finance app that puts all of a person's money in one place and turns it into one number they can trust: net worth. Bank accounts, investments, the pension fund and loans each have their own screen, and all of them feed the same net worth, day by day.

It reads data and never moves money. Bank data arrives read-only through Open Banking; everything else can be imported from a file or entered by hand.

## Who it is for

People in Italy (and, partially, Germany) who already keep track of their money, usually with an expenses app, a spreadsheet for investments and another one for the mortgage, and want a single picture without becoming accountants.

Two kinds of reader use the same screens:

- **Most people** want a plain answer: how much do I have, where did it go this month, am I on track. Screens lead with that answer in everyday words.
- **Tinkerers** want to see how a number was computed. The detail is always one tap away («Per esperti», for experts), and the calculations are documented in [`architecture/`](architecture/).

## What makes it different

- **Local rules where they change the result.** Italian taxation of investments (including the zainetto fiscale, the tax-loss carryforward), the pension fund and TFR (Italian severance pay), and APR (TAEG) on loans. A rule the app cannot apply correctly is shown as a limit, never guessed.
- **Everything in one net worth.** Cash, investments, pension and debts are not separate apps glued together: they share one history.
- **Calculations you can check.** Every figure comes from a pure, tested function in [`lib/calc/`](../lib/calc/).
- **The user decides.** Categories are applied automatically only by the user's rules or by suggestions the app is at least 90% sure of, and the user can always see where each one came from and undo it.
- **Your data stays yours.** Full export and deletion, sensitive fields encrypted at rest, open source code (AGPL-3.0) and a Docker Compose setup to host it yourself.

## Areas

| Area | Question it answers |
| --- | --- |
| Panoramica (overview) | How much do I have, and how is it changing? |
| Liquidità (cash) | Where does my money come from and where does it go? |
| Investimenti (investments) | How are my investments really doing, after costs and taxes? |
| Pensione (pension) | What is my pension fund worth today, and what would I get? |
| Debiti (debts) | What do my loans cost, and how can I pay them off sooner? |
| Analitiche (analytics) | When could I stop working, and what if I saved more? |
| Obiettivi (goals) | When will I reach what I am saving for? |

## What it is not

- Not an advisor: estimates and simulations inform, they are not financial or tax advice.
- Not accounting software: no double-entry bookkeeping, invoices or business use.
- Not a trading tool: prices are end-of-day closes and the app never places orders.

Direction and deferred work are in the [roadmap](../ROADMAP.md).
