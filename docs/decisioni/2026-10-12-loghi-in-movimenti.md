# 2026-10-12 — Merchant logos in Movimenti (Transactions) too

Merchant logos (PR #351) appeared only in Categorizza. Now the Movimenti list in Liquidità shows them too: `GET /api/transactions` adds `logoPath` to each row with the same logic (`withMerchantLogos`: dictionary, website written in the transaction, name search only with `LOGODEV_SECRET_KEY`). The logo takes the place of the category icon, which stays small in the corner: you still tap there to change category. Without a logo (or until it arrives) the usual icon remains. Below the list appears «Loghi forniti da Logo.dev» ("Logos provided by Logo.dev"), as in Categorizza.

In production today there is only `LOGODEV_PUBLISHABLE_KEY`: logos arrive for the dictionary brands and for the websites written in transactions, not for the name search (it needs `LOGODEV_SECRET_KEY` in the `app-logodev-key` Secret).

At Daniele's request the logos appear wherever there is a merchant: also in Abbonamenti (Subscriptions: `loadSubscriptions` adds `logoPath`, the logo replaces the coloured initial) and in Regole (Rules: `GET /api/categorization-rules`, instead of the category icon, which remains written in the menu beside it). Not in the Debiti transaction picker: there the icon is tiny and the list is used to find an instalment.
