# DEGIRO in the shared portfolio

Date: 2026-10-04

Import of the Italian Account.csv with multi-currency reconciliation, EUR fees allocated per order and broker FX rate when present. Operation origin and account/broker association persisted (migration 0021): updates and deletions do not affect the other broker even with overlapping dates. All original rows kept; no NAV or position snapshot invented. The real file was verified locally together with the four IBKR ones; synthetic public fixture. Limits and checks in [degiro-import.md](degiro-import.md). Local branch only, PR postponed.
