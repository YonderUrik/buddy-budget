# Broker filters and return comparison

Date: 2026-10-05

Both inclusion/exclusion of brokers from the combined portfolio and overlay of returns were requested. Temporary filter shared across the Investimenti (Investments) tabs: it does not delete imports and does not change overall net worth, cash or sidebar; it resets on reload/leaving the section. Origin derived from the broker key even within the same portfolio; dedicated legacy rows recognized, other manual/earlier imports kept separate. Comparison as TWR percentage with real dates and a recalculated combined line, never a sum of returns. Umami events for selection and overlay, no financial writes or migration.

The Portfolio also shows securities + cash of the linked broker accounts, including negative balances and accounts without operations. Links are deduplicated per account and filtered by broker.
Cash is already counted in overall net worth: no change to the global calculations. Charts and returns remain securities-only; the cash shows the date of the latest statement, without simulating real-time updates.

Update 2026-10-06: at the user's request, cash is enabled with «Includi liquidità» ("Include cash") in the existing Portfolio card, without an extra panel. On by default; when off it shows securities only, without changing saved balances or charts.
