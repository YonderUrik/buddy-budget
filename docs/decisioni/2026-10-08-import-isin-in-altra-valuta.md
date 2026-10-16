# Import: no automatic link if the ISIN exists in another currency (2026-10-08)

An ISIN has a single shared instrument (unique index), with its currency. If the statement is in EUR and the shared instrument (Tesla) is in USD, the automatic link to the EUR listing reused the USD instrument and the import stopped with «Strumento o valuta non corrispondenti» ("Instrument or currency do not match"). Now in that case the security stays manual in the file's currency, as before the automatic link. Landing impact: none.
