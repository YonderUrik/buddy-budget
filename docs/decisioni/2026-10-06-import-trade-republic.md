# Trade Republic: full import of the Transaction export

Added the Trade Republic provider to the same import path as the statements, with automatic recognition and multiple selection. BUY/SELL feed the investments; all CASH rows feed Movimenti (Transactions) and the dedicated cash account, including card, bank transfers, interest and bonuses.

Cash is rebuilt from amount, fee and tax: the export does not report official balances or account number. A complete history and a single main account per user are required. Updates, duplicates and deletions are handled together with the statements; categories and notes of transactions stay on the IDs already present. No new migration needed.

Details and limits in [trade-republic-import.md](../trade-republic-import.md). Synthetic tests of the parser and of the full cycle on a local database; verification of the 885 rows of the personal export without copying it into the repository. Feature catalog and landing synced. Events and logs of the existing import include the new provider; no new external integration.

The import selector also uses the DEGIRO and Trade Republic SVG logos instead of the initials, with dedicated space for text marks and a white background in both themes. Sources and attributions in `public/import-providers/ATTRIBUTION.md`; files served locally.
