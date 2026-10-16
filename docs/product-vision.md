# BuddyBudget — Product vision

## What it is

BuddyBudget is a personal finance management app designed for people who want to keep their accounts, expenses and savings goals under control without the complexity of accounting software.

## Target user

People who want to track their money in a simple, visual way: monthly budgets, spending by category, savings goals — without having to learn financial jargon or set up complex spreadsheets.

## Value proposition

A clear, immediate overview of one's financial situation (net worth, available balance, spending trend), with the ability to plan a budget and track savings goals, in a polished interface that is quick to use every day.

## Core features (derived from the initial mockup)

The reference mockup (`docs/design-reference/mock-up.html`) outlines 9 functional areas (verified by running the mockup and testing its interactions — for the full detail of what can be done, what cannot and how, see [`docs/functional-spec.md`](./functional-spec.md)):

- **Panoramica** ("Overview") — summary view of net worth, liquidity, investments, pension and latest transactions
- **Conti** ("Accounts") — management of liquidity (linked and manual accounts) from which expenses and transactions draw
- **Spese** ("Expenses") — tracking of categorized outflows, with a monthly budget and a partial exclusion mechanism ("Dividi", "Split") for refunds/shares/internal transfers
- **Cash flow** — income, net outflows and distribution of the surplus (absorbs the concept of "Entrate", "Income")
- **Investimenti** ("Investments") — securities portfolio, buy/sell transactions, composition by type/geography/sector
- **Pensione** ("Pension") — supplementary pension fund with a projection simulator up to maturity
- **Debiti** ("Debts") — mortgage and loans, with an early repayment simulator via an extra installment
- **Pianifica** ("Plan") — what-if simulator of life scenarios (job change, buying a home, children) with a long-term net worth projection (absorbs and extends the concepts of "Budget"/"Risparmi", "Savings")
- **Analitiche** ("Analytics") — advanced derived insights (financial autonomy, real savings rate, financial independence/FIRE, real return, lifestyle inflation, subscription radar)

The mockup has no standalone "Categorie" ("Categories") section: expense categories are a fixed list used inside "Spese".

## Current status and next steps

**Current phase**: design system initialization. The visual tokens (colors, typography, radii) and the base UI components have been defined and can be browsed at `/style-guide`. The functional screens listed above have not been built yet, nor has the application logic (data, authentication, persistence).

**Planned next steps** (not yet planned in detail):
1. Define the data model (accounts, transactions, categories, budgets, goals)
2. Build the real screens starting from the design system components
3. Introduce authentication and data persistence
