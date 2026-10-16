# Import from a statement: listing linked automatically (2026-10-08)

In the «Strumenti» (Instruments) step of a statement import (IBKR, DEGIRO, Trade Republic), instruments with an ISIN are created with automatic prices if OpenFIGI + Yahoo find a listing in the file's currency (same check as «Cerca la quotazione», "Find the listing"); the row is «Da controllare» ("To check") and can be changed in the step. If there is no listing, or the sources do not respond, they stay manual with the broker's prices as before. This changes the previous choice («manuale finché non si collega a mano», "manual until linked by hand"), at the user's request. The statement prices remain saved.
Landing impact: none. Observability: no new signal (reuses the ISIN search already tracked).
