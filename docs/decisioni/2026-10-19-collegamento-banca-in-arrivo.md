# 2026-10-19 — Bank connection «In arrivo» and «Tienimi aggiornato»

New bank connections through GoCardless are closed on the hosted version: GoCardless takes no new sign-ups, the free plan is nearly full and no other provider is in place yet. A new bank is refused with `paused` (`BANK_CONNECTIONS_OPEN`, unset = closed when hosted, open when self-hosted); people who already have a connection keep it and can still renew it, so nobody loses a working bank.

In «Nuovo conto» the bank choice sits below manual account and import, marked «In arrivo», with «Tienimi aggiornato»: one row per person in `bank_connection_interest` (migration 0048), withdrawable with «Non avvisarmi più», counted in the `gocardless_capacity` gauge (`interested`) and tracked in Umami (`bank_connect_interest_registered`). The announcement email to those people is a one-off send for when connections reopen, not built yet. Landing, /sicurezza, feature catalog (now `soon`) and empty states no longer promise a bank connection. Privacy explains the request (consent, art. 6.1.a): `LEGAL_VERSION` 2026-10-21. Living doc §4.1 of `docs/architecture/bank-sync-and-imports.md`.

## Follow-up (2026-10-21): landing, security page and legal texts

The landing, `/sicurezza`, Privacy and Terms still described the GoCardless connection as available to everyone. Now they say it is closed for new accounts and describe it only for the people who already have one: the sheet tour on the home page and `llms.txt` no longer promise a connection, the security page presents the data path "for people with a bank connected", and Privacy states in the data, provider and open-banking sections that no new banks are connected today. `LEGAL_VERSION` is 2026-10-22 (everyone re-accepts).
