# Leverage of the broker account (2026-11-03)

Asked by the owner for his Interactive Brokers margin loan. Investimenti now shows it instead of hiding it in a negative cash balance:

- **Leverage strip** in Portafoglio (a navy band under the hero, chosen by Daniele on 2026-11-08 among two cards and three page layouts; the first version was a card in the side column), with the details in a dialog: securities at today's prices, margin loan by currency from the last statement, own capital, leverage ratio and loan-to-value; debit interest by year, last 12 months and the effective rate on the average borrowed; the fall that brings the loan to a maintenance margin the user sets (default 25%), labelled as an estimate because the CSV has no per-security requirement.
- **Costs card**: margin interest added to the total.
- **Performance**: «Sui titoli» / «Sul tuo capitale». The capital basis rebuilds the account's cash day by day from its statements; deposits and withdrawals become the flows, interest lowers the return.
- **Panoramica**: a negative broker balance is a «Prestito a margine» liability in the composition; the total and the chart (stored cash history) are unchanged.

No migration: everything comes from the stored statements. IBKR only (DEGIRO and Trade Republic have no comparable ledger). Deferred: currency exposure of a foreign-currency loan, IBKR's live margin requirement, the loan as its own class in the stored history. Living docs: `docs/architecture/investments.md` §4.17, `net-worth.md` §4.9.
- **Nothing without a loan**: an account that does not borrow today shows nothing about leverage anywhere (strip, costs line, Performance switch, Panoramica row), even if it paid interest in the past.
