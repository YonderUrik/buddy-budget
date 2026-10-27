# Subscriptions with changing bank descriptions (2026-10-26)

Daniele's «Non addebitati da un po'» listed subscriptions that were still charged: the same merchant came back with another PayPal code (`PAYPAL *NOW 1292C` → `X5105`), another Apple invoice number, the date of the card operation inside the text, or a different spelling (`CLAUDE.AI SUBSCRIPTION ANTHROPIC.COM` → `Anthropic Claude Sub Anthropic.com`), and a series split by amount stopped at a price change.

Decided: detection groups by merchant (dictionary brand, else website, else words without codes, card and date tail), follows a stopped series into the merchant's later charges across price changes (never into a subscription that ran alongside it), and lets an active series replace a stopped one of the same merchant after a pause. Known brands show their name («NOW», «Claude», «Apple», «Fastweb»). Choices saved under the old keys keep applying through the series' `aliases`; duplicates are hidden. No migration, nothing stored changes.

Unchanged: one merchant billing several subscriptions is still split by amount, and a price change under the cadence's spread (e.g. 16.99 → 17.99 monthly) is still read as a constant amount. Living doc §4.13 of `docs/architecture/categorisation.md`.
