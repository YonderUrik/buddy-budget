# Email amounts are independent of frontend privacy

- The monthly summary incorrectly reused the saved `hideAmounts` preference in the notification context, replacing all monetary values with `••••`.
- Notification recipients no longer load that preference; all notification templates receive a locale/currency-bound `Intl.NumberFormat` instead of the frontend privacy-aware formatter.
- The web privacy toggle and its persisted setting remain unchanged. Email layout, translations, delivery and financial calculations are unchanged; no migration is required.
- Regression tests cover saved privacy ON/OFF, active frontend masking, HTML/plain text, negative/zero/decimal values, unavailable returns and IT/EN/DE formatting.
- No impact on the landing, no new signal, no impact on frontend performance; existing notification logs and metrics remain applicable.
- Deferred: a real delivered monthly email can be checked after deployment. Slack backlog updates require the operator because this session has no Slack connector.
