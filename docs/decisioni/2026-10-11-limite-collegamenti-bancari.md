# GoCardless bank connection limit (2026-10-11)

The free plan of GoCardless Bank Account Data gives 50 connections. From today: **one bank per person**, **at most 40 new banks** across the whole app, **3 consents per person in 31 days** (new, renewals and unfinished attempts); renewals of an already linked bank use the reserve up to 50. All configurable (`GOCARDLESS_MAX_CONNECTIONS_PER_USER`, `GOCARDLESS_MAX_ATTEMPTS_PER_USER`, `GOCARDLESS_MAX_CONNECTIONS`, `GOCARDLESS_PROVIDER_LIMIT`).

- **What counts**: the GoCardless documentation does not say whether deleting a requisition frees the slot within the month (the error is `CompanyRequisitionLimitReached`, 402; user reports say it does not). So the slots used are the **greater** of live requisitions and consents started in the last 31 days, counted from the new table `bank_connection_attempts` (migration 0032), which is not emptied when a connection is deleted.
- **No overshoot from simultaneous requests**: counting and creating the connection happen in a transaction with `pg_advisory_xact_lock` (test with 10 requests in parallel).
- **Unlinking frees immediately**: deleting a bank's last account, or renewing on a new connection, deletes the requisition on GoCardless and the row (if GoCardless does not respond, it is left to the daily cleanup).
- **Whoever already has several banks** keeps them and can renew them; they cannot add more.
- Interface: in the «Nuovo conto» ("New account") dialog the «Collega la tua banca» ("Connect your bank") choice becomes unavailable with «In arrivo» ("Coming soon": slots exhausted) or «Una per persona» ("One per person"), and points to manual account and file import.
- Postponed: waiting list with a notice when a slot frees up, number of remaining slots visible to users.
