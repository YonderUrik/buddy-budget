# «Cerca» answers questions, with logos (2026-10-25)

After #513 Daniele asked for totals inside the search («soldi spesi su serenis nel 2026»), merchant and security logos in the results, and a discreet way to ask simple questions about his own data. Asked how far to go, he chose «Sì, AI solo su tocco», everything in one PR.

- Questions are read by rules in the browser (it/en/de) and answered by the server on the user's rows, as one «Risposta» row above the results: how much was spent or received in a year or a month (for a merchant, a category or everything), the balance of one or all accounts, the net worth (on a past day only through the AI), the portfolio or one security, the next instalment. The row opens what it sums (Movimenti with `?periodo=&data=` and the same filter).
- Totals by category or for everything are summed in SQL over the whole history; totals by words follow the Movimenti text filter, so they decrypt only the last 24 months and say «solo gli ultimi 24 mesi» when the period goes further back. Transfers count as 0 and are not counted, as in Movimenti.
- What the rules cannot read goes to the AI only on «Chiedi all'AI» (same consent, limits and cache as #513). The model only translates the sentence into one of the fixed questions; the server computes the figure and a template writes the row. The model never sees an amount, an account or a movement. Privacy and Terms say so, `LEGAL_VERSION` 2026-10-26 (2026-10-25 belongs to #513).
- Movements, groups of the same merchant and subscriptions show the merchant's logo (`withMerchantLogos`, as in Movimenti); securities their icon.
- Phone: the panel follows the area above the keyboard (`visualViewport`), the page under it no longer scrolls, and the list scrolls only for arrow keys, so typing no longer makes the panel jump (Daniele's report).

Rejected: a chat window, and letting the model see the user's figures to write the answer (privacy and cost).
